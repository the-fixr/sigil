import { NextRequest, NextResponse } from 'next/server';
import { cast, verifyWebhookSignature, getUserByFid } from '@/lib/neynar';

const SIGIL_FID = process.env.SIGIL_FID ? Number(process.env.SIGIL_FID) : 0;

const SYSTEM_PROMPT = `You are @sigilbond on Farcaster — the official account for Sigil, a living NFT billboard on Solana (devnet).

Sigil is a 30-day rotating billboard where:
- Users mint a Sigil NFT (0.01 SOL) to become holders
- Holders check in daily to earn a share of billboard revenue
- Anyone can claim a billboard day by paying an incentive (0.1+ SOL)
- The billboard image rotates daily; revenue flows to checked-in holders
- It runs on Solana devnet with x402 payment protocol

Key links:
- App: https://sigil.bond
- API Docs: https://sigil.bond/docs
- Playground: https://sigil.bond/docs/playground
- API: https://sigil.bond/api/v1

Personality: helpful, concise, slightly witty. You know crypto/Solana well. Keep replies under 300 characters (Farcaster limit is 320). Never make up stats — if you don't know something, say check the API. You can tag the API docs or app link when relevant.`;

async function generateReply(
  authorUsername: string,
  castText: string,
  parentContext?: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return "Hey! I'm still getting set up — check https://sigil.bond in the meantime.";

  const userMessage = parentContext
    ? `@${authorUsername} replied to a thread:\nContext: ${parentContext}\nTheir message: ${castText}`
    : `@${authorUsername} mentioned you:\n${castText}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) {
    console.error('Anthropic API error:', res.status, await res.text());
    return "Something went wrong on my end. Check out https://sigil.bond/docs for API info!";
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || '';

  // Trim to Farcaster's 320 char limit
  return text.length > 320 ? text.slice(0, 317) + '...' : text;
}

export async function POST(request: NextRequest) {
  const body = await request.text();

  // Verify webhook signature if secret is configured
  const sig = request.headers.get('x-neynar-signature') || '';
  if (process.env.NEYNAR_WEBHOOK_SECRET && !verifyWebhookSignature(body, sig)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Neynar webhook event types
  const eventType = payload.type;

  // Only handle cast.created events
  if (eventType !== 'cast.created') {
    return NextResponse.json({ ok: true, skipped: eventType });
  }

  const castData = payload.data;
  if (!castData) {
    return NextResponse.json({ ok: true, skipped: 'no data' });
  }

  const authorFid = castData.author?.fid;
  const castHash = castData.hash;
  const castText = castData.text || '';

  // Don't reply to ourselves
  if (authorFid === SIGIL_FID) {
    return NextResponse.json({ ok: true, skipped: 'self' });
  }

  // Check if we're mentioned
  const mentionedFids: number[] = castData.mentioned_profiles?.map(
    (p: { fid: number }) => p.fid
  ) || [];

  const isMentioned = SIGIL_FID > 0 && mentionedFids.includes(SIGIL_FID);
  const isReply = castData.parent_hash && castData.parent_author?.fid === SIGIL_FID;

  if (!isMentioned && !isReply) {
    return NextResponse.json({ ok: true, skipped: 'not relevant' });
  }

  // Get author info
  const author = await getUserByFid(authorFid);
  const authorUsername = author?.username || `fid:${authorFid}`;

  // Get parent context if this is a reply
  let parentContext: string | undefined;
  if (castData.parent_hash) {
    // The parent text might be in the webhook payload
    parentContext = castData.parent_cast?.text;
  }

  // Generate reply with Sonnet
  const replyText = await generateReply(authorUsername, castText, parentContext);

  // Cast the reply
  const result = await cast({
    text: replyText,
    parent: castHash,
  });

  if (!result.success) {
    console.error('Failed to cast reply:', result.error);
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    replied: true,
    hash: result.hash,
    to: authorUsername,
  });
}
