import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet');
  const epochDay = Number(request.nextUrl.searchParams.get('epochDay'));

  if (!wallet || !epochDay) {
    return NextResponse.json({ checkedIn: false, totalCheckedIn: 0 });
  }

  // Check if this wallet already checked in today
  const { data: checkIn } = await supabase
    .from('check_ins')
    .select('weight')
    .eq('epoch_day', epochDay)
    .eq('wallet', wallet)
    .single();

  // Get total check-ins for today
  const { count } = await supabase
    .from('check_ins')
    .select('*', { count: 'exact', head: true })
    .eq('epoch_day', epochDay);

  if (checkIn) {
    // Find their position
    const { count: beforeCount } = await supabase
      .from('check_ins')
      .select('*', { count: 'exact', head: true })
      .eq('epoch_day', epochDay)
      .lt('id', checkIn.weight); // This is approximate — let's use checked_in_at

    return NextResponse.json({
      checkedIn: true,
      weight: checkIn.weight,
      position: (beforeCount ?? 0) + 1,
      totalCheckedIn: count ?? 0,
    });
  }

  return NextResponse.json({
    checkedIn: false,
    totalCheckedIn: count ?? 0,
  });
}
