'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useWallet } from '@solana/wallet-adapter-react';
import { getCurrentEpochDay } from '@/lib/solana';
import { useFrameSDK } from '@/components/FrameSDK';

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

function InstallBanner() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Don't show if already installed as PWA or dismissed
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if (localStorage.getItem('sigil-install-dismissed')) return;

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(ios);

    if (ios) {
      // iOS: show instructions banner
      setShow(true);
    } else {
      // Chrome/Android: listen for native install prompt
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setShow(true);
      };
      window.addEventListener('beforeinstallprompt', handler);
      return () => window.removeEventListener('beforeinstallprompt', handler);
    }
  }, []);

  function dismiss() {
    setShow(false);
    localStorage.setItem('sigil-install-dismissed', '1');
  }

  async function handleInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') dismiss();
      setDeferredPrompt(null);
    }
  }

  if (!show) return null;

  return (
    <div className="w-full max-w-lg mb-4 p-3 rounded-xl bg-accent/10 border border-accent/20 flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="" className="w-10 h-10 rounded-xl flex-shrink-0" />
      <div className="flex-1 min-w-0">
        {isIOS ? (
          <p className="text-xs text-foreground">
            Tap <span className="inline-flex items-center align-middle mx-0.5"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg></span> then <strong>&quot;Add to Home Screen&quot;</strong>
          </p>
        ) : (
          <p className="text-xs text-foreground">Install Sigil for quick access</p>
        )}
      </div>
      {!isIOS && deferredPrompt && (
        <button
          onClick={handleInstall}
          className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold flex-shrink-0"
        >
          Install
        </button>
      )}
      <button onClick={dismiss} className="text-muted hover:text-foreground p-1 flex-shrink-0" aria-label="Dismiss">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

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

type Tab = 'home' | 'mint' | 'claim';

const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'mint', label: 'Mint' },
  { id: 'claim', label: 'Claim' },
];

export default function Home() {
  const { connected } = useWallet();
  const { context, isLoaded, isInMiniApp } = useFrameSDK();
  const [tab, setTab] = useState<Tab>('home');
  const [totalMinted, setTotalMinted] = useState(0);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [platformFee, setPlatformFee] = useState(50_000_000); // default tier 1 (0.05 SOL)
  const [calendarKey, setCalendarKey] = useState(0);
  const [todayImageUrl, setTodayImageUrl] = useState<string | undefined>();

  const today = getCurrentEpochDay();
  const fcUser = context?.user;

  // Fetch today's billboard image + mint count
  useEffect(() => {
    fetch('/api/calendar')
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.totalMinted === 'number') {
          setTotalMinted(data.totalMinted);
        }
        const todayClaim = data.days?.find((d: { isToday: boolean }) => d.isToday);
        if (todayClaim?.hasImage) {
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

  // Show loading while detecting Farcaster context
  if (!isLoaded) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-muted">Loading Sigil...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-6 sm:py-10">
      {/* Install banner */}
      {!isInMiniApp && <InstallBanner />}

      {/* Header */}
      <header className="w-full max-w-lg flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/sigil.png" alt="Sigil" className="w-9 h-9 rounded-xl" />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
              <span className="text-accent">SIGIL</span>
            </h1>
            <p className="text-xs text-muted mt-0.5">Billboard That Pays Rent &middot; sigil.bond</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {isInMiniApp && fcUser ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface border border-border">
              {fcUser.pfpUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fcUser.pfpUrl} alt="" className="w-6 h-6 rounded-full" />
              )}
              <span className="text-sm font-medium text-foreground">
                {fcUser.displayName || fcUser.username || `FID ${fcUser.fid}`}
              </span>
            </div>
          ) : (
            <WalletMultiButton />
          )}
        </div>
      </header>

      {/* Tabs */}
      <nav className="w-full max-w-lg flex items-center gap-1 mb-6 bg-surface rounded-xl border border-border p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === t.id
                ? 'bg-accent text-white shadow-sm'
                : 'text-muted hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className="w-full max-w-lg space-y-6">
        {/* Home tab: Check-in + Rewards */}
        {tab === 'home' && (
          <>
            <CheckIn epochDay={today} billboardImageUrl={todayImageUrl} />
            <RewardsClaim epochDay={today} />
          </>
        )}

        {/* Mint tab */}
        {tab === 'mint' && (
          <MintCard
            totalMinted={totalMinted}
            onMinted={() => setTotalMinted((n) => n + 1)}
          />
        )}

        {/* Claim tab: Calendar + ClaimSheet trigger */}
        {tab === 'claim' && (
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
        )}

        {/* Footer */}
        <footer className="text-center py-6 space-y-2">
          <div className="flex items-center justify-center gap-3 text-[11px] text-muted/50">
            <a href="/terms" className="hover:text-muted transition-colors">Terms</a>
            <span>&middot;</span>
            <a href="/privacy" className="hover:text-muted transition-colors">Privacy</a>
            <span>&middot;</span>
            <a href="/docs" className="hover:text-muted transition-colors">API Docs</a>
          </div>
          <div className="flex items-center justify-center gap-3 text-[11px] text-muted/50">
            <a href="https://farcaster.xyz/sigilbond" target="_blank" rel="noopener noreferrer" className="hover:text-muted transition-colors">Farcaster</a>
            <span>&middot;</span>
            <a href="https://t.me/sigil_bond" target="_blank" rel="noopener noreferrer" className="hover:text-muted transition-colors">Telegram</a>
            <span>&middot;</span>
            <a href="https://bsky.app/profile/sigilbond.bsky.social" target="_blank" rel="noopener noreferrer" className="hover:text-muted transition-colors">Bluesky</a>
            <span>&middot;</span>
            <a href="https://hey.xyz/u/sigilbond" target="_blank" rel="noopener noreferrer" className="hover:text-muted transition-colors">Lens</a>
            <span>&middot;</span>
            <a href="https://discord.com/oauth2/authorize?client_id=1472771144435105812&permissions=2048&scope=bot%20applications.commands" target="_blank" rel="noopener noreferrer" className="hover:text-muted transition-colors">Discord</a>
          </div>
          <p className="text-[10px] text-muted/30">Billboard NFT on Solana &middot; devnet</p>
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