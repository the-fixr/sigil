import { NextRequest, NextResponse } from 'next/server';
import { getCurrentEpochDay } from '@/lib/solana';
import { getServiceClient } from '@/lib/supabase';

// Vercel crons invoke GET
export async function GET(request: NextRequest) {
  return handleSettle(request);
}

export async function POST(request: NextRequest) {
  return handleSettle(request);
}

async function handleSettle(request: NextRequest) {
  try {
    // Simple auth: check for cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServiceClient();
    const yesterday = getCurrentEpochDay() - 1;

    // Check if day has a claim
    const { data: claim } = await supabase
      .from('day_claims')
      .select('epoch_day, total_weight, incentive_lamports')
      .eq('epoch_day', yesterday)
      .single();

    if (!claim) {
      return NextResponse.json({ message: 'No claim for yesterday', settled: false });
    }

    // Guard: don't re-settle
    if (claim.total_weight > 0) {
      return NextResponse.json({ message: 'Already settled', settled: false });
    }

    // Sum weights for yesterday
    const { data: weightData } = await supabase
      .from('check_ins')
      .select('weight')
      .eq('epoch_day', yesterday);

    const totalWeight = (weightData || []).reduce((sum, row) => sum + row.weight, 0);

    if (totalWeight === 0) {
      return NextResponse.json({ message: 'No check-ins for yesterday', settled: false });
    }

    // Update day_claims with total weight
    const { error } = await supabase
      .from('day_claims')
      .update({ total_weight: totalWeight })
      .eq('epoch_day', yesterday);

    if (error) {
      console.error('Settle error:', error);
      return NextResponse.json({ error: 'Failed to settle' }, { status: 500 });
    }

    return NextResponse.json({
      settled: true,
      epochDay: yesterday,
      totalWeight,
      incentiveLamports: claim.incentive_lamports,
    });
  } catch (error) {
    console.error('Settle cron error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}