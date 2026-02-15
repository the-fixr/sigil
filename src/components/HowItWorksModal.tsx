'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'sigil-how-it-works-v2';

interface HowItWorksModalProps {
  walletConnected: boolean;
}

export default function HowItWorksModal({ walletConnected }: HowItWorksModalProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!walletConnected) return;
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      setOpen(true);
    }
  }, [walletConnected]);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm sheet-backdrop"
        onClick={dismiss}
      />

      <div className="modal-content relative w-full max-w-md bg-surface border border-border rounded-2xl p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-foreground mb-4">How Sigil Works</h2>

        <div className="space-y-4 text-sm text-muted leading-relaxed">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
              <span className="text-accent font-bold text-xs">1</span>
            </div>
            <div>
              <div className="font-semibold text-foreground mb-0.5">Mint a Sigil (0.01 SOL)</div>
              <div>10,000 billboard NFTs. Same dynamic image &mdash; changes every day based on who claims it.</div>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
              <span className="text-accent font-bold text-xs">2</span>
            </div>
            <div>
              <div className="font-semibold text-foreground mb-0.5">Advertisers Claim Days</div>
              <div>Anyone can claim a day on the calendar. Upload a billboard image and fund an incentive pool for holders.</div>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
              <span className="text-accent font-bold text-xs">3</span>
            </div>
            <div>
              <div className="font-semibold text-foreground mb-0.5">Check In Daily</div>
              <div>Holders sign in daily (free, gasless). First 1,000 each day earn 2x weight toward that day&apos;s rewards.</div>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
              <span className="text-accent font-bold text-xs">4</span>
            </div>
            <div>
              <div className="font-semibold text-foreground mb-0.5">Earn SOL</div>
              <div>After each day settles, claim your share of the incentive pool based on your check-in weight.</div>
            </div>
          </div>
        </div>

        <button
          onClick={dismiss}
          className="mt-6 w-full py-2.5 rounded-xl bg-accent text-white font-semibold text-sm
            hover:bg-accent/90 transition-colors active:scale-[0.98]"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
