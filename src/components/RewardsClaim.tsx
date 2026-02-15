'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';

interface RewardsClaimProps {
  epochDay: number;
}

interface DayBreakdown {
  epochDay: number;
  weight: number;
  totalWeight: number;
  incentiveLamports: number;
  earnedLamports: number;
  pendingLamports: number;
}

export default function RewardsClaim({ epochDay }: RewardsClaimProps) {
  const { publicKey, signMessage, connected } = useWallet();
  const [pendingSol, setPendingSol] = useState(0);
  const [daysCheckedIn, setDaysCheckedIn] = useState(0);
  const [bonusDays, setBonusDays] = useState(0);
  const [dayBreakdown, setDayBreakdown] = useState<DayBreakdown[]>([]);
  const [claiming, setClaiming] = useState(false);
  const [status, setStatus] = useState('');
  const [txSignature, setTxSignature] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchRewards = useCallback(async () => {
    if (!publicKey) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/rewards?wallet=${publicKey.toString()}`);
      const data = await res.json();
      setPendingSol(data.pendingSol || 0);
      setDaysCheckedIn(data.daysCheckedIn || 0);
      setBonusDays(data.bonusDays || 0);
      setDayBreakdown(data.dayBreakdown || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => { fetchRewards(); }, [fetchRewards]);

  async function handleClaim() {
    if (!publicKey || !signMessage || pendingSol <= 0) return;
    setClaiming(true);
    setStatus('Sign message...');

    try {
      const message = `Sigil claim rewards: ${epochDay}`;
      const messageBytes = new TextEncoder().encode(message);
      const sig = await signMessage(messageBytes);

      setStatus('Claiming...');

      const res = await fetch('/api/rewards/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: publicKey.toString(),
          signature: bs58.encode(sig),
          message,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Claim failed');

      setTxSignature(data.txSignature);
      setPendingSol(0);
      setStatus('');
      fetchRewards();
    } catch (err) {
      setStatus((err as Error).message);
      setTimeout(() => setStatus(''), 4000);
    } finally {
      setClaiming(false);
    }
  }

  if (!connected || loading) return null;
  if (daysCheckedIn === 0 && pendingSol === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-foreground mb-3">Rewards</h2>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center">
          <div className="text-lg font-bold text-accent">{pendingSol.toFixed(4)}</div>
          <div className="text-[10px] text-muted">Pending SOL</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-foreground">{daysCheckedIn}</div>
          <div className="text-[10px] text-muted">Days</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-foreground">{bonusDays}</div>
          <div className="text-[10px] text-muted">2x Days</div>
        </div>
      </div>

      {pendingSol > 0 && (
        <button
          onClick={handleClaim}
          disabled={claiming}
          className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-[0.98]
            bg-accent text-white hover:bg-accent/90
            disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {claiming ? status || 'Claiming...' : `Claim ${pendingSol.toFixed(4)} SOL`}
        </button>
      )}

      {txSignature && (
        <a
          href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-[10px] text-accent/70 hover:text-accent text-center mt-2 truncate"
        >
          TX: {txSignature.slice(0, 20)}...
        </a>
      )}

      {status && !claiming && (
        <div className="text-xs text-center text-red-400 mt-2">{status}</div>
      )}

      {dayBreakdown.length > 0 && (
        <details className="mt-3">
          <summary className="text-[10px] text-muted cursor-pointer hover:text-foreground">
            View breakdown ({dayBreakdown.length} days)
          </summary>
          <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
            {dayBreakdown.map((d) => (
              <div key={d.epochDay} className="flex justify-between text-[10px] text-muted">
                <span>Day {d.epochDay} ({d.weight}x)</span>
                <span>{(d.pendingLamports / 1e9).toFixed(6)} SOL</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
