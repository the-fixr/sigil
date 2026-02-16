import { NextRequest, NextResponse } from 'next/server';
import {
  verifyDiscordSignature,
  InteractionType,
  InteractionResponseType,
} from '@/lib/discord';
import { getCurrentEpochDay } from '@/lib/solana';
import { supabase } from '@/lib/supabase';
import { getServiceClient } from '@/lib/supabase';

const LAMPORTS_PER_SOL = 1_000_000_000;
const SITE = 'https://sigil.bond';

/**
 * Discord Interactions endpoint.
 * Receives slash commands via HTTP POST (no gateway needed).
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');

  if (!signature || !timestamp) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
  }

  const body = await request.text();

  if (!verifyDiscordSignature(body, signature, timestamp)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const interaction: any = JSON.parse(body);

  // PING — Discord verification handshake
  if (interaction.type === InteractionType.PING) {
    return NextResponse.json({ type: InteractionResponseType.PONG });
  }

  // Slash commands
  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    const name = interaction.data?.name;

    switch (name) {
      case 'sigil-today':
        return respond(await handleToday());
      case 'sigil-stats':
        return respond(await handleStats());
      case 'sigil-leaderboard':
        return respond(await handleLeaderboard());
      case 'sigil-subscribe':
        return respond(await handleSubscribe(interaction));
      default:
        return respond('Unknown command. Try `/sigil-today`');
    }
  }

  return NextResponse.json({ type: InteractionResponseType.PONG });
}

function respond(content: string) {
  return NextResponse.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content },
  });
}

// ── Command Handlers ───────────────────────────────────────────────

async function handleToday(): Promise<string> {
  const today = getCurrentEpochDay();
  const dayInCycle = today % 30;

  const { data: claim } = await supabase
    .from('day_claims')
    .select('claimer_wallet, incentive_lamports, farcaster_username')
    .eq('epoch_day', today)
    .single();

  const { data: checkIns } = await supabase
    .from('check_ins')
    .select('wallet')
    .eq('epoch_day', today);

  const checkInCount = checkIns?.length || 0;
  const lines: string[] = [];

  lines.push(`**Day ${dayInCycle + 1}/30** (epoch ${today})`);

  if (claim) {
    const sol = (claim.incentive_lamports / LAMPORTS_PER_SOL).toFixed(2);
    const who = claim.farcaster_username
      ? `@${claim.farcaster_username}`
      : `\`${claim.claimer_wallet.slice(0, 8)}...\``;
    lines.push(`Billboard: **${who}**`);
    lines.push(`Incentive: ${sol} SOL`);
  } else {
    lines.push('Billboard: **Unclaimed**');
    lines.push(`Claim it at ${SITE}`);
  }

  lines.push(`Check-ins today: ${checkInCount}`);

  return lines.join('\n');
}

async function handleStats(): Promise<string> {
  const today = getCurrentEpochDay();

  const [mintResult, claimResult, checkInResult] = await Promise.all([
    supabase.from('nft_mints').select('*', { count: 'exact', head: true }),
    supabase.from('day_claims').select('incentive_lamports'),
    supabase.from('check_ins').select('*', { count: 'exact', head: true }),
  ]);

  const totalMinted = mintResult.count || 0;
  const totalCheckIns = checkInResult.count || 0;
  const claims = claimResult.data || [];
  const totalClaims = claims.length;
  const totalIncentive = claims.reduce((sum, c) => sum + (c.incentive_lamports || 0), 0);
  const totalSol = (totalIncentive / LAMPORTS_PER_SOL).toFixed(2);

  return [
    '**Sigil Protocol Stats**',
    `Sigils minted: ${totalMinted.toLocaleString()}`,
    `Days claimed: ${totalClaims}`,
    `Total incentives: ${totalSol} SOL`,
    `Total check-ins: ${totalCheckIns.toLocaleString()}`,
    `Current epoch day: ${today}`,
    SITE,
  ].join('\n');
}

async function handleLeaderboard(): Promise<string> {
  const { data } = await supabase
    .from('check_ins')
    .select('wallet');

  if (!data || data.length === 0) {
    return `No check-ins yet. Be the first at ${SITE}`;
  }

  const counts: Record<string, number> = {};
  for (const row of data) {
    counts[row.wallet] = (counts[row.wallet] || 0) + 1;
  }

  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];
  const lines: string[] = ['**Top Check-in Holders**', ''];

  for (let i = 0; i < sorted.length; i++) {
    const [wallet, count] = sorted[i];
    const prefix = i < 3 ? medals[i] : `${i + 1}.`;
    const short = wallet.slice(0, 4) + '..' + wallet.slice(-4);
    lines.push(`${prefix} \`${short}\` \u2014 ${count} day${count !== 1 ? 's' : ''}`);
  }

  lines.push('');
  lines.push(SITE);

  return lines.join('\n');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscribe(interaction: any): Promise<string> {
  const guildId = interaction.guild_id;
  const channelId = interaction.channel_id;
  const memberPermissions = BigInt(interaction.member?.permissions || '0');

  if (!guildId) {
    return 'This command can only be used in a server.';
  }

  // Check MANAGE_CHANNELS permission (bit 4)
  const MANAGE_CHANNELS = BigInt(1 << 4);
  if ((memberPermissions & MANAGE_CHANNELS) === BigInt(0)) {
    return 'You need **Manage Channels** permission to subscribe a channel.';
  }

  try {
    const sb = getServiceClient();

    // Upsert subscription
    const { error } = await sb
      .from('discord_subscriptions')
      .upsert(
        { guild_id: guildId, channel_id: channelId, subscribed_at: new Date().toISOString() },
        { onConflict: 'guild_id' }
      );

    if (error) {
      console.error('Discord subscribe error:', error);
      return 'Failed to subscribe. Try again later.';
    }

    return `This channel is now subscribed to Sigil updates! You\u2019ll get daily billboard recaps, mint milestones, and record alerts.\n\nUse \`/sigil-subscribe\` in a different channel to move updates there.`;
  } catch (error) {
    console.error('Discord subscribe error:', error);
    return 'Failed to subscribe. Try again later.';
  }
}
