import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { getCurrentEpochDay, getProgram, getProtocolPda } from '@/lib/solana';

export const dynamic = 'force-dynamic';

// Platform fee tiers (must match on-chain)
const TIER_PRICES = [
  { max: 10, price: 50_000_000 },     // 0.05 SOL
  { max: 20, price: 40_000_000 },     // 0.04 SOL
  { max: 29, price: 30_000_000 },     // 0.03 SOL
  { max: Infinity, price: 20_000_000 }, // 0.02 SOL
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
    const windowStart = today; // include today for billboard display
    const windowEnd = today + 30;

    // Fetch all claims in the 30-day window
    const supabase = getServiceClient();
    const { data: claims } = await supabase
      .from('day_claims')
      .select('epoch_day, claimer_wallet, incentive_lamports, image_url, farcaster_username, farcaster_pfp_url, moderation_status')
      .gte('epoch_day', windowStart)
      .lte('epoch_day', windowEnd)
      .order('epoch_day', { ascending: true });

    const totalClaims = claims?.length || 0;

    // Fetch on-chain mint count
    let totalMinted = 0;
    try {
      const program = getProgram();
      const [protocolPda] = getProtocolPda();
      const protocol = await program.account.protocol.fetch(protocolPda);
      totalMinted = (protocol as { totalMinted: number }).totalMinted;
    } catch {
      // Protocol not initialized yet or RPC error — default to 0
    }

    // Build calendar grid
    const days = [];
    for (let d = windowStart; d <= windowEnd; d++) {
      const claim = claims?.find((c) => c.epoch_day === d);
      const date = new Date(d * 86400 * 1000);
      const status = claim?.moderation_status || null;
      const isApproved = status === 'approved';
      days.push({
        epochDay: d,
        date: date.toISOString().split('T')[0],
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        isToday: d === today,
        claimed: !!claim,
        moderationStatus: status,
        incentiveSol: claim && isApproved ? (claim.incentive_lamports / 1e9).toFixed(2) : null,
        hasImage: !!(claim?.image_url && isApproved),
        farcasterUsername: claim && isApproved ? claim.farcaster_username || null : null,
        farcasterPfp: claim && isApproved ? claim.farcaster_pfp_url || null : null,
        wallet: claim?.claimer_wallet || null,
      });
    }

    return NextResponse.json({
      days,
      today,
      platformFee: getTierPrice(totalClaims),
      totalClaims,
      totalMinted,
    });
  } catch (error) {
    console.error('Calendar error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}