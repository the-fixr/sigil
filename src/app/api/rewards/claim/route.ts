import { NextRequest, NextResponse } from 'next/server';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { getConnection, getServerKeypair, getCurrentEpochDay, pollConfirmation } from '@/lib/solana';
import { getServiceClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { wallet, signature, message } = await request.json();
    if (!wallet || !signature || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify signature
    const expectedMessage = `Sigil claim rewards: ${getCurrentEpochDay()}`;
    if (message !== expectedMessage) {
      return NextResponse.json({ error: 'Invalid or expired claim message' }, { status: 400 });
    }

    const publicKey = new PublicKey(wallet);
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKey.toBytes());
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const supabase = getServiceClient();

    // Calculate pending rewards (same logic as GET /api/rewards)
    const { data: checkIns } = await supabase
      .from('check_ins')
      .select('epoch_day, weight')
      .eq('wallet', wallet);

    if (!checkIns || checkIns.length === 0) {
      return NextResponse.json({ error: 'No check-ins found' }, { status: 400 });
    }

    const epochDays = checkIns.map((c) => c.epoch_day);
    const { data: claims } = await supabase
      .from('day_claims')
      .select('epoch_day, incentive_lamports, total_weight')
      .in('epoch_day', epochDays)
      .gt('total_weight', 0);

    const { data: distributed } = await supabase
      .from('reward_ledger')
      .select('epoch_day, amount_lamports')
      .eq('wallet', wallet)
      .in('status', ['sent', 'pending']);

    const distributedByDay = new Map<number, number>();
    (distributed || []).forEach((r) => {
      distributedByDay.set(r.epoch_day, (distributedByDay.get(r.epoch_day) || 0) + r.amount_lamports);
    });

    let totalPending = 0;
    const pendingDays: { epochDay: number; amount: number }[] = [];

    for (const claim of (claims || [])) {
      const checkIn = checkIns.find((c) => c.epoch_day === claim.epoch_day);
      if (!checkIn || claim.total_weight === 0) continue;

      const earned = Math.floor((checkIn.weight / claim.total_weight) * claim.incentive_lamports);
      const paid = distributedByDay.get(claim.epoch_day) || 0;
      const pending = Math.max(0, earned - paid);

      if (pending > 0) {
        totalPending += pending;
        pendingDays.push({ epochDay: claim.epoch_day, amount: pending });
      }
    }

    if (totalPending === 0) {
      return NextResponse.json({ error: 'No pending rewards' }, { status: 400 });
    }

    // Send SOL from incentive wallet to holder
    const connection = getConnection();
    const serverKeypair = getServerKeypair();

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: serverKeypair.publicKey,
        toPubkey: publicKey,
        lamports: totalPending,
      })
    );
    tx.feePayer = serverKeypair.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.sign(serverKeypair);

    const txSig = await connection.sendRawTransaction(tx.serialize());
    await pollConfirmation(connection, txSig);

    // Record in ledger
    for (const day of pendingDays) {
      await supabase.from('reward_ledger').insert({
        epoch_day: day.epochDay,
        wallet,
        amount_lamports: day.amount,
        tx_signature: txSig,
        status: 'sent',
      });
    }

    return NextResponse.json({
      success: true,
      totalLamports: totalPending,
      totalSol: totalPending / 1e9,
      txSignature: txSig,
      daysSettled: pendingDays.length,
    });
  } catch (error) {
    console.error('Reward claim error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
