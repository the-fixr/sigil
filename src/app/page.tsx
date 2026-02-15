'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useWallet } from '@solana/wallet-adapter-react';
import { getCurrentEpochDay } from '@/lib/solana';

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then((m) => m.WalletMultiButton),
  { ssr: false }
);
import Calendar from '@/components/Calendar';
import MintCard from '@/components/MintCard';
import ClaimSheet from '@/components/ClaimSheet';
import CheckIn from '@/components/CheckIn';
import RewardsClaim from '@/components/RewardsClaim';
import HowItWorksModal from '@/components/HowItWorksModal';

function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('sigil-theme', next ? 'dark' : 'light');
  }

  return (
    <button
      onClick={toggle}
      className="w-9 h-9 rounded-xl border border-border bg-surface flex items-center justify-center
        text-muted hover:text-foreground hover:border-accent/30 transition-colors"
      aria-label="Toggle theme"
    >
      {dark ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M14 9.2A6 6 0 016.8 2 6 6 0 1014 9.2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

export default function Home() {
  const { connected } = useWallet();
  const [totalMinted, setTotalMinted] = useState(0);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [platformFee, setPlatformFee] = useState(2_000_000_000); // default tier 1
  const [calendarKey, setCalendarKey] = useState(0);
  const [todayImageUrl, setTodayImageUrl] = useState<string | undefined>();

  const today = getCurrentEpochDay();

  // Fetch today's billboard image
  useEffect(() => {
    fetch('/api/calendar')
      .then((r) => r.json())
      .then((data) => {
        const todayClaim = data.days?.find((d: { isToday: boolean }) => d.isToday);
        if (todayClaim?.hasImage) {
          // Construct image URL from Supabase storage
          const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          if (baseUrl) {
            setTodayImageUrl(`${baseUrl}/storage/v1/object/public/day-images/day-${todayClaim.epochDay}.png`);
          }
        }
      })
      .catch(() => {});
  }, [calendarKey]);

  const handleClaimed = useCallback(() => {
    setSelectedDay(null);
    setCalendarKey((k) => k + 1);
  }, []);

  const handlePlatformFeeLoaded = useCallback((fee: number) => {
    setPlatformFee(fee);
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-6 sm:py-10">
      {/* Header */}
      <header className="w-full max-w-lg flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            <span className="text-accent">SIGIL</span>
          </h1>
          <p className="text-xs text-muted mt-0.5">Billboard That Pays Rent &middot; sigil.bond</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <WalletMultiButton />
        </div>
      </header>

      {/* Content */}
      <div className="w-full max-w-lg space-y-6">
        {/* Check-In (prominent, top section) */}
        <CheckIn epochDay={today} billboardImageUrl={todayImageUrl} />

        {/* Mint Card */}
        <MintCard
          totalMinted={totalMinted}
          onMinted={() => setTotalMinted((n) => n + 1)}
        />

        {/* Rewards */}
        <RewardsClaim epochDay={today} />

        {/* Calendar */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Billboard Calendar</h2>
            <span className="text-xs text-muted font-mono">30 days</span>
          </div>
          <Calendar
            key={calendarKey}
            onSelectDay={setSelectedDay}
            selectedDay={selectedDay}
            onPlatformFeeLoaded={handlePlatformFeeLoaded}
          />
        </section>

        {/* Footer */}
        <footer className="text-center text-[11px] text-muted/50 py-6">
          sigil.bond &middot; Billboard NFT on Solana
        </footer>
      </div>

      {/* How It Works Modal */}
      <HowItWorksModal walletConnected={connected} />

      {/* Claim Sheet */}
      {selectedDay !== null && (
        <ClaimSheet
          epochDay={selectedDay}
          onClose={() => setSelectedDay(null)}
          onClaimed={handleClaimed}
          platformFee={platformFee}
        />
      )}
    </main>
  );
}
