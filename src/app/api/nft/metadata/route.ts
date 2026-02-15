import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentEpochDay } from '@/lib/solana';

export async function GET() {
  try {
    const today = getCurrentEpochDay();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    // Look up today's claim
    const { data: claim } = await supabase
      .from('day_claims')
      .select('*')
      .eq('epoch_day', today)
      .single();

    // Count check-ins for today
    const { count: checkInCount } = await supabase
      .from('check_ins')
      .select('*', { count: 'exact', head: true })
      .eq('epoch_day', today);

    const advertiser = claim?.farcaster_username || claim?.claimer_wallet?.slice(0, 8) || 'No one';
    const incentiveSol = claim ? (claim.incentive_lamports / 1e9).toFixed(2) : '0';

    return NextResponse.json(
      {
        name: 'Sigil',
        symbol: 'SIGIL',
        description: `A living NFT billboard. Today's advertiser: ${advertiser}. ${incentiveSol} SOL pool. ${checkInCount || 0} checked in.`,
        image: claim?.image_url || `${baseUrl}/sigil.png`,
        external_url: baseUrl,
        attributes: [
          { trait_type: 'Type', value: 'Billboard NFT' },
          { trait_type: 'Supply', value: '10,000' },
          { trait_type: 'Advertiser', value: advertiser },
          { trait_type: 'Incentive Pool', value: `${incentiveSol} SOL` },
          { trait_type: 'Check-ins Today', value: String(checkInCount || 0) },
          { trait_type: 'Epoch Day', value: String(today) },
        ],
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=60',
        },
      }
    );
  } catch (error) {
    console.error('Metadata error:', error);
    return NextResponse.json(
      {
        name: 'Sigil',
        symbol: 'SIGIL',
        description: 'A living NFT billboard. Check in daily to earn.',
        image: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/sigil.png`,
        attributes: [{ trait_type: 'Type', value: 'Billboard NFT' }],
      },
      { status: 200 }
    );
  }
}
