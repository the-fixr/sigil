import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get('wallet');
    if (!wallet) {
      return NextResponse.json({ error: 'Missing wallet parameter' }, { status: 400 });
    }

    const supabase = getServiceClient();

    // Get all check-ins for this wallet
    const { data: checkIns } = await supabase
      .from('check_ins')
      .select('epoch_day, weight')
      .eq('wallet', wallet);

    if (!checkIns || checkIns.length === 0) {
      return NextResponse.json({ pendingLamports: 0, pendingSol: 0, dayBreakdown: [] });
    }

    // Get settled days (total_weight > 0) that this wallet checked into
    const epochDays = checkIns.map((c) => c.epoch_day);
    const { data: claims } = await supabase
      .from('day_claims')
      .select('epoch_day, incentive_lamports, total_weight')
      .in('epoch_day', epochDays)
      .gt('total_weight', 0);

    if (!claims || claims.length === 0) {
      return NextResponse.json({ pendingLamports: 0, pendingSol: 0, dayBreakdown: [] });
    }

    // Get already-distributed rewards
    const { data: distributed } = await supabase
      .from('reward_ledger')
      .select('epoch_day, amount_lamports')
      .eq('wallet', wallet)
      .in('status', ['sent', 'pending']);

    const distributedByDay = new Map<number, number>();
    (distributed || []).forEach((r) => {
      distributedByDay.set(r.epoch_day, (distributedByDay.get(r.epoch_day) || 0) + r.amount_lamports);
    });

    // Calculate pending per day
    const dayBreakdown: { epochDay: number; weight: number; totalWeight: number; incentiveLamports: number; earnedLamports: number; paidLamports: number; pendingLamports: number }[] = [];
    let totalPending = 0;

    for (const claim of claims) {
      const checkIn = checkIns.find((c) => c.epoch_day === claim.epoch_day);
      if (!checkIn || claim.total_weight === 0) continue;

      const earned = Math.floor((checkIn.weight / claim.total_weight) * claim.incentive_lamports);
      const paid = distributedByDay.get(claim.epoch_day) || 0;
      const pending = Math.max(0, earned - paid);

      dayBreakdown.push({
        epochDay: claim.epoch_day,
        weight: checkIn.weight,
        totalWeight: claim.total_weight,
        incentiveLamports: claim.incentive_lamports,
        earnedLamports: earned,
        paidLamports: paid,
        pendingLamports: pending,
      });

      totalPending += pending;
    }

    return NextResponse.json({
      pendingLamports: totalPending,
      pendingSol: totalPending / 1e9,
      daysCheckedIn: checkIns.length,
      bonusDays: checkIns.filter((c) => c.weight === 2).length,
      dayBreakdown,
    });
  } catch (error) {
    console.error('Rewards error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
