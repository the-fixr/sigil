import { NextRequest, NextResponse } from 'next/server';
import { getCurrentEpochDay } from '@/lib/solana';
import { supabase } from '@/lib/supabase';
import { cast } from '@/lib/neynar';
import { postToChannel } from '@/lib/telegram';

const LAMPORTS_PER_SOL = 1_000_000_000;

/** Post to both Farcaster and Telegram channel. */
async function broadcast(text: string, embeds?: { url: string }[]): Promise<{ fc: boolean; tg: boolean }> {
  const [fcResult, tgResult] = await Promise.all([
    cast({ text, embeds }),
    postToChannel(text),
  ]);
  return { fc: fcResult.success, tg: tgResult };
}

/**
 * Notification cron — runs daily (or on demand).
 * Checks for notable events and posts to Farcaster as @sigilbond.
 *
 * Trigger: Vercel cron or POST with CRON_SECRET
 */
export async function POST(request: NextRequest) {
  // Auth
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = getCurrentEpochDay();
  const yesterday = today - 1;
  const posted: string[] = [];

  try {
    // 1. Day flip — announce yesterday's billboard + today is open
    const { data: yesterdayClaim } = await supabase
      .from('day_claims')
      .select('epoch_day, claimer_wallet, incentive_lamports, farcaster_username, image_url, link_url')
      .eq('epoch_day', yesterday)
      .single();

    if (yesterdayClaim) {
      const sol = (yesterdayClaim.incentive_lamports / LAMPORTS_PER_SOL).toFixed(2);
      const who = yesterdayClaim.farcaster_username
        ? `@${yesterdayClaim.farcaster_username}`
        : yesterdayClaim.claimer_wallet.slice(0, 8) + '...';

      const embeds: { url: string }[] = [];
      if (yesterdayClaim.link_url) embeds.push({ url: yesterdayClaim.link_url });
      if (yesterdayClaim.image_url) embeds.push({ url: yesterdayClaim.image_url });

      const text = `Day ${yesterday} billboard by ${who} (${sol} SOL incentive).\n\nToday's billboard is open — claim it at sigil.bond`;

      const result = await broadcast(text, embeds);
      if (result.fc || result.tg) posted.push('day_flip');
    }

    // 2. Largest incentive ever — check if yesterday was a record
    const { data: allClaims } = await supabase
      .from('day_claims')
      .select('epoch_day, incentive_lamports')
      .order('incentive_lamports', { ascending: false })
      .limit(1);

    if (
      allClaims?.[0] &&
      allClaims[0].epoch_day === yesterday &&
      yesterdayClaim &&
      yesterdayClaim.incentive_lamports >= 500_000_000 // only if >= 0.5 SOL
    ) {
      const sol = (yesterdayClaim.incentive_lamports / LAMPORTS_PER_SOL).toFixed(2);
      const text = `New record! Day ${yesterday} set the highest incentive ever on Sigil: ${sol} SOL.\n\nsigil.bond`;
      const result = await broadcast(text);
      if (result.fc || result.tg) posted.push('record_incentive');
    }

    // 3. Mint milestones
    const { count } = await supabase
      .from('nft_mints')
      .select('*', { count: 'exact', head: true });

    const totalMinted = count || 0;
    const milestones = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

    for (const m of milestones) {
      if (totalMinted >= m && totalMinted < m + 5) {
        // Check if we already posted this milestone (simple: skip if > 5 past it)
        const text = `${m} Sigils minted! The billboard grows.\n\nMint yours at sigil.bond`;
        const result = await broadcast(text);
        if (result.fc || result.tg) posted.push(`milestone_${m}`);
        break; // only post one milestone per run
      }
    }

    // 4. High check-in day
    const { data: checkInData } = await supabase
      .from('check_ins')
      .select('epoch_day')
      .eq('epoch_day', yesterday);

    const checkInCount = checkInData?.length || 0;
    if (checkInCount >= 50) {
      const text = `${checkInCount} holders checked in on Day ${yesterday}. The Sigil community is active.\n\nsigil.bond`;
      const result = await broadcast(text);
      if (result.fc || result.tg) posted.push('high_checkins');
    }

    return NextResponse.json({ ok: true, posted, today, yesterday });
  } catch (error) {
    console.error('Notify cron error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
