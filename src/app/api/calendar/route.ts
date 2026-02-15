import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentEpochDay } from '@/lib/solana';

// Platform fee tiers (must match on-chain)
const TIER_PRICES = [
  { max: 10, price: 2_000_000_000 },  // 2.0 SOL
  { max: 20, price: 1_500_000_000 },  // 1.5 SOL
  { max: 29, price: 1_000_000_000 },  // 1.0 SOL
  { max: Infinity, price: 500_000_000 }, // 0.5 SOL
];

function getTierPrice(totalClaims: number): number {
  for (const tier of TIER_PRICES) {
    if (totalClaims <= tier.max) return tier.price;
  }
  return TIER_PRICES[TIER_PRICES.length - 1].price;
}

export async function GET() {
  try {
    const today = getCurrentEpochDay();
    const windowStart = today;
    const windowEnd = today + 30;

    // Fetch all claims in the 30-day window
    const { data: claims } = await supabase
      .from('day_claims')
      .select('epoch_day, claimer_wallet, incentive_lamports, image_url, farcaster_username, farcaster_pfp_url')
      .gte('epoch_day', windowStart)
      .lte('epoch_day', windowEnd)
      .order('epoch_day', { ascending: true });

    const totalClaims = claims?.length || 0;

    // Build calendar grid
    const days = [];
    for (let d = windowStart; d <= windowEnd; d++) {
      const claim = claims?.find((c) => c.epoch_day === d);
      const date = new Date(d * 86400 * 1000);
      days.push({
        epochDay: d,
        date: date.toISOString().split('T')[0],
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        isToday: d === today,
        claimed: !!claim,
        incentiveSol: claim ? (claim.incentive_lamports / 1e9).toFixed(2) : null,
        hasImage: !!claim?.image_url,
        farcasterUsername: claim?.farcaster_username || null,
        farcasterPfp: claim?.farcaster_pfp_url || null,
        wallet: claim?.claimer_wallet || null,
      });
    }

    return NextResponse.json({
      days,
      today,
      platformFee: getTierPrice(totalClaims),
      totalClaims,
    });
  } catch (error) {
    console.error('Calendar error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
