/**
 * Lens Protocol v3 posting helper for Sigil.
 *
 * Env vars:
 *   LENS_PRIVATE_KEY — EVM private key managing the Lens account (no 0x prefix)
 */

import { privateKeyToAccount } from 'viem/accounts';

const LENS_API = 'https://api.lens.xyz/graphql';
const GROVE_API = 'https://api.grove.storage/?chain_id=37111';

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function lensGQL(
  query: string,
  variables: Record<string, unknown>,
  accessToken?: string
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Origin: 'https://sigil.bond',
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(LENS_API, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });

  return res.json();
}

async function authenticate(): Promise<string> {
  // Reuse token for ~25 minutes
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const pk = process.env.LENS_PRIVATE_KEY;
  if (!pk) throw new Error('LENS_PRIVATE_KEY not set');

  const account = privateKeyToAccount(`0x${pk.replace(/^0x/, '')}` as `0x${string}`);
  const address = account.address;

  // 1. Get Lens account
  const acctResult = await lensGQL(
    `query($managedBy: EvmAddress!) {
      accountsAvailable(request: { managedBy: $managedBy, includeOwned: true }) {
        items { ... on AccountOwned { account { address } } ... on AccountManaged { account { address } } }
      }
    }`,
    { managedBy: address }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (acctResult as any)?.data?.accountsAvailable?.items;
  const lensAccount = items?.[0]?.account?.address;
  if (!lensAccount) throw new Error('No Lens account found for this wallet');

  // 2. Challenge
  const challengeResult = await lensGQL(
    `mutation($request: ChallengeRequest!) {
      challenge(request: $request) { id text }
    }`,
    { request: { accountOwner: { account: lensAccount, owner: address } } }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const challenge = (challengeResult as any)?.data?.challenge;
  if (!challenge?.id) throw new Error('Failed to get Lens challenge');

  // 3. Sign with EIP-191
  const signature = await account.signMessage({ message: challenge.text });

  // 4. Authenticate
  const authResult = await lensGQL(
    `mutation($request: SignedAuthChallenge!) {
      authenticate(request: $request) {
        ... on AuthenticationTokens { accessToken refreshToken }
        ... on WrongSignerError { reason }
        ... on ExpiredChallengeError { reason }
        ... on ForbiddenError { reason }
      }
    }`,
    { request: { id: challenge.id, signature } }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const auth = (authResult as any)?.data?.authenticate;
  if (!auth?.accessToken) {
    throw new Error(`Lens auth failed: ${auth?.reason || JSON.stringify(auth)}`);
  }

  cachedToken = auth.accessToken as string;
  tokenExpiry = Date.now() + 25 * 60 * 1000;
  return cachedToken!;
}

/**
 * Post to Lens Protocol.
 */
export async function postToLens(text: string): Promise<boolean> {
  if (!process.env.LENS_PRIVATE_KEY) {
    console.warn('LENS_PRIVATE_KEY not set, skipping Lens post');
    return false;
  }

  try {
    const accessToken = await authenticate();

    // Upload metadata to Grove
    const metadata = {
      $schema: 'https://json-schemas.lens.dev/publications/text-only/3.0.0.json',
      lens: {
        mainContentFocus: 'TEXT_ONLY',
        content: text,
        locale: 'en',
        id: crypto.randomUUID(),
      },
    };

    const groveRes = await fetch(GROVE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
    });

    if (!groveRes.ok) {
      console.error('Grove upload failed:', groveRes.status, await groveRes.text());
      return false;
    }

    const groveData = await groveRes.json();
    // Grove returns an array
    const contentUri = Array.isArray(groveData) ? groveData[0]?.uri : groveData?.uri;
    if (!contentUri) {
      console.error('No content URI from Grove:', groveData);
      return false;
    }

    // Post
    const postResult = await lensGQL(
      `mutation($request: CreatePostRequest!) {
        post(request: $request) {
          ... on PostResponse { hash }
          ... on SponsoredTransactionRequest { reason }
          ... on SelfFundedTransactionRequest { reason }
          ... on TransactionWillFail { reason }
        }
      }`,
      { request: { contentUri } },
      accessToken
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const post = (postResult as any)?.data?.post;
    if (post?.hash) return true;

    console.error('Lens post failed:', post?.reason || JSON.stringify(postResult));
    cachedToken = null;
    tokenExpiry = 0;
    return false;
  } catch (error) {
    console.error('Lens post error:', error);
    cachedToken = null;
    tokenExpiry = 0;
    return false;
  }
}
