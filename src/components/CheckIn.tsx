'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';

interface CheckInProps {
  epochDay: number;
  billboardImageUrl?: string;
}

export default function CheckIn({ epochDay, billboardImageUrl }: CheckInProps) {
  const { publicKey, signMessage, connected } = useWallet();
  const [checkedIn, setCheckedIn] = useState(false);
  const [position, setPosition] = useState(0);
  const [totalCheckedIn, setTotalCheckedIn] = useState(0);
  const [weight, setWeight] = useState(1);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [status, setStatus] = useState('');

  const checkStatus = useCallback(async () => {
    if (!publicKey) { setChecking(false); return; }
    try {
      const res = await fetch(
        `/api/check-in/status?wallet=${publicKey.toString()}&epochDay=${epochDay}`
      );
      const data = await res.json();
      if (data.checkedIn) {
        setCheckedIn(true);
        setPosition(data.position);
        setWeight(data.weight);
      }
      setTotalCheckedIn(data.totalCheckedIn || 0);
    } catch {
      // ignore
    } finally {
      setChecking(false);
    }
  }, [publicKey, epochDay]);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  async function handleCheckIn() {
    if (!publicKey || !signMessage) return;
    setLoading(true);
    setStatus('Sign message...');

    try {
      const message = `Sigil check-in: ${epochDay}`;
      const messageBytes = new TextEncoder().encode(message);
      const sig = await signMessage(messageBytes);

      setStatus('Recording...');

      const res = await fetch('/api/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: publicKey.toString(),
          signature: bs58.encode(sig),
          message,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Check-in failed');

      setCheckedIn(true);
      setPosition(data.position);
      setWeight(data.weight);
      setTotalCheckedIn(data.totalCheckedIn);
      setStatus('');
    } catch (err) {
      setStatus((err as Error).message);
      setTimeout(() => setStatus(''), 4000);
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <section className="rounded-2xl border border-border bg-surface overflow-hidden">
        <div className="aspect-[2/1] bg-gradient-to-br from-[#0c0a1a] via-[#1a1040] to-[#0c0a1a] animate-pulse" />
        <div className="p-4 space-y-2">
          <div className="h-4 bg-border rounded animate-pulse w-1/2" />
          <div className="h-3 bg-border rounded animate-pulse w-1/3" />
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-surface overflow-hidden">
      {/* Billboard image */}
      <div className="aspect-[2/1] bg-gradient-to-br from-[#0c0a1a] via-[#1a1040] to-[#0c0a1a] flex items-center justify-center relative overflow-hidden">
        {billboardImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={billboardImageUrl}
            alt="Today's billboard"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-center">
            <div className="text-3xl font-extrabold text-white/20 mb-1">SIGIL</div>
            <div className="text-xs text-white/20">No billboard today</div>
          </div>
        )}

        {/* Check-in count badge */}
        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm
          text-[10px] font-mono text-white/70">
          {totalCheckedIn} checked in
        </div>
      </div>

      {/* Check-in area */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Daily Check-In</h2>
            <p className="text-[11px] text-muted mt-0.5">
              {totalCheckedIn < 1000
                ? `${1000 - totalCheckedIn} spots left for 2x bonus`
                : 'Bonus spots filled \u2014 still earn 1x'}
            </p>
          </div>

          {checkedIn && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[10px] font-semibold text-green-500">
                #{position} &middot; {weight}x
              </span>
            </div>
          )}
        </div>

        {connected ? (
          checkedIn ? (
            <div className="text-xs text-muted text-center py-2 bg-background rounded-xl border border-border">
              Checked in today &mdash; weight: {weight}x
            </div>
          ) : (
            <button
              onClick={handleCheckIn}
              disabled={loading}
              className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-[0.98]
                bg-accent text-white hover:bg-accent/90
                disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? status || 'Checking in...' : 'Check In (free)'}
            </button>
          )
        ) : (
          <div className="text-xs text-muted text-center py-2">
            Connect wallet to check in
          </div>
        )}

        {status && !loading && (
          <div className="text-xs text-center text-red-400 mt-2">{status}</div>
        )}
      </div>
    </section>
  );
}
