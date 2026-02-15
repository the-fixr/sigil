/**
 * Neynar casting helper for the @sigilbond Farcaster account.
 */

import crypto from 'crypto';

const NEYNAR_API = 'https://api.neynar.com/v2/farcaster';

function getApiKey(): string {
  const key = process.env.NEYNAR_API_KEY;
  if (!key) throw new Error('NEYNAR_API_KEY not set');
  return key;
}

function getSignerUUID(): string {
  const uuid = process.env.NEYNAR_SIGIL_SIGNER_UUID;
  if (!uuid) throw new Error('NEYNAR_SIGIL_SIGNER_UUID not set');
  return uuid;
}

interface CastOptions {
  text: string;
  parent?: string; // parent cast hash (for replies)
  embeds?: { url: string }[];
}

interface CastResult {
  success: boolean;
  hash?: string;
  error?: string;
}

export async function cast(opts: CastOptions): Promise<CastResult> {
  const body: Record<string, unknown> = {
    signer_uuid: getSignerUUID(),
    text: opts.text,
  };
  if (opts.parent) body.parent = opts.parent;
  if (opts.embeds?.length) body.embeds = opts.embeds;

  const res = await fetch(`${NEYNAR_API}/cast`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': getApiKey(),
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    return { success: false, error: data.message || `Neynar ${res.status}` };
  }

  return { success: true, hash: data.cast?.hash };
}

/**
 * Verify a Neynar webhook signature.
 */
export function verifyWebhookSignature(
  body: string,
  signature: string
): boolean {
  const secret = process.env.NEYNAR_WEBHOOK_SECRET;
  if (!secret) return false;

  try {
    const hmac = crypto.createHmac('sha512', secret);
    hmac.update(body);
    const expected = hmac.digest('hex');
    return expected === signature;
  } catch {
    return false;
  }
}

/**
 * Look up a Farcaster user by FID.
 */
export async function getUserByFid(fid: number): Promise<{
  username: string;
  displayName: string;
  pfpUrl: string;
} | null> {
  const res = await fetch(`${NEYNAR_API}/user/bulk?fids=${fid}`, {
    headers: { accept: 'application/json', 'x-api-key': getApiKey() },
  });

  if (!res.ok) return null;

  const data = await res.json();
  const user = data.users?.[0];
  if (!user) return null;

  return {
    username: user.username,
    displayName: user.display_name || user.username,
    pfpUrl: user.pfp_url || '',
  };
}
