import { NextRequest, NextResponse } from 'next/server';
import {
  cast,
  verifyWebhookSignature,
  getUserProfile,
  getUserRecentCasts,
  type UserProfile,
  type RecentCast,
} from '@/lib/neynar';

const SIGIL_FID = process.env.SIGIL_FID ? Number(process.env.SIGIL_FID) : 0;

const SYSTEM_PROMPT = `You are @sigilbond on Farcaster — the official account for Sigil, a living NFT billboard on Solana.

## What Sigil Is
A 30-day rotating billboard NFT on Solana (devnet). Mint for 0.01 SOL, check in daily to earn revenue share, claim a day for 0.1+ SOL to put your project on the billboard. x402 payment protocol. API-first.

## Your Personality
You are a dyed-in-the-wool SOL bro. Solana is home. You live and breathe fast blocks and cheap fees. You're snarky, quick-witted, and always ready with a dunk — but never actually mean. Think "roast battle between friends" energy. You punch up, not down.

Guidelines:
- ALWAYS bring it back to Solana somehow. ETH is slow. L2s are cope. Base is fine but it's not home.
- Be genuinely funny. Dry wit > try-hard humor. One-liners hit harder than paragraphs.
- If someone is talking about a competing chain, give them friendly grief about it.
- If someone is building something cool, gas them up AND dunk on them affectionately.
- If they're a small account, be encouraging underneath the snark.
- If they're a big account, be more bold with the roasts.
- Reference their recent posts when you can — show you did your homework. This is key. Don't be generic.
- Drop sigil.bond naturally when relevant, never forced.
- You can use "ser", "anon", "ngmi", "wagmi", "gm" etc. naturally but don't overdo it.
- NO emojis unless absolutely necessary. Let the words do the work.
- Keep replies under 280 characters. Tight is right.

## What NOT to Do
- Never be cruel, racist, sexist, or punch down on someone struggling.
- Never fake stats or claim features that don't exist.
- Never shill aggressively — confidence, not desperation.
- Never start with "Hey!" or "Thanks for the mention!" — that's bot energy.
- Never explain Sigil in full unless directly asked. Mystery is marketing.`;

function buildUserContext(
  profile: UserProfile,
  recentCasts: RecentCast[]
): string {
  const lines: string[] = [];

  lines.push(`--- INTEL ON @${profile.username} ---`);
  lines.push(`Display: ${profile.displayName}`);
  lines.push(`Bio: ${profile.bio || '(empty)'}`);
  lines.push(`Followers: ${profile.followers} | Following: ${profile.following}`);
  if (profile.powerBadge) lines.push('Has power badge (notable account)');
  if (profile.verifiedAddresses.length > 0) {
    const hasSOL = profile.verifiedAddresses.some((a) => a.length > 30 && !a.startsWith('0x'));
    const hasETH = profile.verifiedAddresses.some((a) => a.startsWith('0x'));
    if (hasSOL && hasETH) lines.push('Verified: SOL + ETH wallets (multichain)');
    else if (hasSOL) lines.push('Verified: SOL wallet (one of us)');
    else if (hasETH) lines.push('Verified: ETH wallet only (has not seen the light yet)');
  }

  if (recentCasts.length > 0) {
    lines.push('');
    lines.push('Recent posts (newest first):');
    for (const c of recentCasts.slice(0, 10)) {
      const engagement = `[${c.likes}L ${c.recasts}RC ${c.replies}R]`;
      // Truncate long posts
      const text = c.text.length > 140 ? c.text.slice(0, 137) + '...' : c.text;
      lines.push(`  ${engagement} "${text}"`);
    }
  }

  lines.push('--- END INTEL ---');
  return lines.join('\n');
}

async function generateReply(
  authorFid: number,
  castText: string,
  parentContext?: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return 'gm. still booting up — check sigil.bond';
  }

  // Scan the user in parallel
  const [profile, recentCasts] = await Promise.all([
    getUserProfile(authorFid),
    getUserRecentCasts(authorFid, 15),
  ]);

  const intel = profile ? buildUserContext(profile, recentCasts) : `Unknown user fid:${authorFid}`;

  let userMessage = `${intel}\n\n`;

  if (parentContext) {
    userMessage += `They replied to your cast: "${parentContext}"\n`;
    userMessage += `Their reply: "${castText}"`;
  } else {
    userMessage += `They mentioned you in this cast: "${castText}"`;
  }

  userMessage += '\n\nWrite a reply. Remember: under 280 chars, snarky but not mean, bring it back to SOL.';

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
    return 'something broke but at least it broke fast (solana speed). check sigil.bond';
  }

  const data = await res.json();
  let text = data.content?.[0]?.text || '';

  // Strip quotes if Sonnet wraps the reply in them
  text = text.replace(/^["']|["']$/g, '').trim();

  // Hard limit
  if (text.length > 320) text = text.slice(0, 317) + '...';

  return text;
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

  if (payload.type !== 'cast.created') {
    return NextResponse.json({ ok: true, skipped: payload.type });
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

  // Check if we're mentioned or replied to
  const mentionedFids: number[] =
    castData.mentioned_profiles?.map((p: { fid: number }) => p.fid) || [];

  const isMentioned = SIGIL_FID > 0 && mentionedFids.includes(SIGIL_FID);
  const isReply =
    castData.parent_hash && castData.parent_author?.fid === SIGIL_FID;

  if (!isMentioned && !isReply) {
    return NextResponse.json({ ok: true, skipped: 'not relevant' });
  }

  // Get parent context if replying to our cast
  const parentContext: string | undefined = castData.parent_cast?.text;

  // Generate reply — this fetches the user's profile + recent casts internally
  const replyText = await generateReply(authorFid, castText, parentContext);

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
  });
}
