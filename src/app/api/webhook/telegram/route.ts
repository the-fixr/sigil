import { NextRequest, NextResponse } from 'next/server';
import { sendMessage, type TelegramUpdate } from '@/lib/telegram';
import { getCurrentEpochDay } from '@/lib/solana';
import { supabase } from '@/lib/supabase';

const LAMPORTS_PER_SOL = 1_000_000_000;
const SITE = 'https://sigil.bond';

/**
 * Telegram Bot webhook — receives updates from Telegram Bot API.
 * Responds to slash commands with billboard data from Supabase.
 */
export async function POST(request: NextRequest) {
  // Verify secret token if configured
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const header = request.headers.get('x-telegram-bot-api-secret-token');
    if (header !== secret) {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
    }
  }

  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const msg = update.message;
  if (!msg?.text) {
    return NextResponse.json({ ok: true });
  }

  const chatId = msg.chat.id;
  const command = msg.text.split(' ')[0].split('@')[0].toLowerCase();

  switch (command) {
    case '/start':
    case '/help':
      await handleHelp(chatId);
      break;
    case '/today':
    case '/status':
      await handleToday(chatId);
      break;
    case '/mint':
      await handleMint(chatId);
      break;
    case '/leaderboard':
      await handleLeaderboard(chatId);
      break;
    case '/stats':
      await handleStats(chatId);
      break;
    default:
      // Ignore non-commands
      break;
  }

  return NextResponse.json({ ok: true });
}

// ── Command handlers ──────────────────────────────────────────────

async function handleHelp(chatId: number) {
  const text = [
    '<b>Sigil Billboard Bot</b>',
    '',
    '30-day rotating NFT billboard on Solana.',
    'Mint a Sigil, check in daily, earn revenue share.',
    '',
    '<b>Commands:</b>',
    '/today — Current billboard status',
    '/mint — How to mint a Sigil',
    '/leaderboard — Top check-in streaks',
    '/stats — Protocol numbers',
    '/help — This message',
    '',
    `<a href=\"${SITE}\">sigil.bond</a>`,
  ].join('\n');

  await sendMessage({ chatId, text });
}

async function handleToday(chatId: number) {
  const today = getCurrentEpochDay();
  const dayInCycle = today % 30;

  // Check if today is claimed
  const { data: claim } = await supabase
    .from('day_claims')
    .select('claimer_wallet, incentive_lamports, farcaster_username, image_url')
    .eq('epoch_day', today)
    .single();

  // Check-ins today
  const { data: checkIns } = await supabase
    .from('check_ins')
    .select('wallet')
    .eq('epoch_day', today);

  const checkInCount = checkIns?.length || 0;

  const lines: string[] = [];
  lines.push(`<b>Day ${dayInCycle + 1}/30</b> (epoch ${today})`);
  lines.push('');

  if (claim) {
    const sol = (claim.incentive_lamports / LAMPORTS_PER_SOL).toFixed(2);
    const who = claim.farcaster_username
      ? `@${claim.farcaster_username}`
      : claim.claimer_wallet.slice(0, 8) + '...';
    lines.push(`Billboard: <b>${who}</b>`);
    lines.push(`Incentive: ${sol} SOL`);
  } else {
    lines.push('Billboard: <b>Unclaimed</b>');
    lines.push(`Claim it at <a href=\"${SITE}\">sigil.bond</a>`);
  }

  lines.push('');
  lines.push(`Check-ins today: ${checkInCount}`);

  await sendMessage({ chatId, text: lines.join('\n') });
}

async function handleMint(chatId: number) {
  const { count } = await supabase
    .from('nft_mints')
    .select('*', { count: 'exact', head: true });

  const totalMinted = count || 0;

  const text = [
    '<b>Mint a Sigil</b>',
    '',
    `Minted so far: ${totalMinted.toLocaleString()} / 10,000`,
    'Price: 0.01 SOL',
    'Network: Solana devnet',
    '',
    'Holders can check in daily for revenue share when the billboard is claimed.',
    '',
    `<a href=\"${SITE}\">Mint at sigil.bond</a>`,
  ].join('\n');

  await sendMessage({ chatId, text });
}

async function handleLeaderboard(chatId: number) {
  // Get wallets with most check-ins (all time)
  const { data } = await supabase
    .from('check_ins')
    .select('wallet');

  if (!data || data.length === 0) {
    await sendMessage({ chatId, text: 'No check-ins yet. Be the first at sigil.bond' });
    return;
  }

  // Count check-ins per wallet
  const counts: Record<string, number> = {};
  for (const row of data) {
    counts[row.wallet] = (counts[row.wallet] || 0) + 1;
  }

  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const medals = ['\ud83e\udd47', '\ud83e\udd48', '\ud83e\udd49'];
  const lines: string[] = ['<b>Top Check-in Holders</b>', ''];

  for (let i = 0; i < sorted.length; i++) {
    const [wallet, count] = sorted[i];
    const prefix = i < 3 ? medals[i] : `${i + 1}.`;
    const short = wallet.slice(0, 4) + '..' + wallet.slice(-4);
    lines.push(`${prefix} <code>${short}</code> — ${count} day${count !== 1 ? 's' : ''}`);
  }

  lines.push('');
  lines.push(`<a href=\"${SITE}\">sigil.bond</a>`);

  await sendMessage({ chatId, text: lines.join('\n') });
}

async function handleStats(chatId: number) {
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

  const text = [
    '<b>Sigil Protocol Stats</b>',
    '',
    `Sigils minted: ${totalMinted.toLocaleString()}`,
    `Days claimed: ${totalClaims}`,
    `Total incentives: ${totalSol} SOL`,
    `Total check-ins: ${totalCheckIns.toLocaleString()}`,
    `Current epoch day: ${today}`,
    '',
    `<a href=\"${SITE}\">sigil.bond</a>`,
  ].join('\n');

  await sendMessage({ chatId, text });
}
