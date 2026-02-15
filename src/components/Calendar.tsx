'use client';

import { useState, useEffect } from 'react';

interface CalendarDay {
  epochDay: number;
  date: string;
  label: string;
  isToday: boolean;
  claimed: boolean;
  incentiveSol: string | null;
  hasImage: boolean;
  farcasterUsername: string | null;
  farcasterPfp: string | null;
  wallet: string | null;
}

interface CalendarProps {
  onSelectDay: (epochDay: number) => void;
  selectedDay: number | null;
  onPlatformFeeLoaded?: (fee: number) => void;
}

export default function Calendar({ onSelectDay, selectedDay, onPlatformFeeLoaded }: CalendarProps) {
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/calendar')
      .then((r) => r.json())
      .then((data) => {
        setDays(data.days || []);
        if (data.platformFee && onPlatformFeeLoaded) {
          onPlatformFeeLoaded(data.platformFee);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [onPlatformFeeLoaded]);

  if (loading) {
    return (
      <div className="grid grid-cols-5 sm:grid-cols-7 gap-1.5">
        {Array.from({ length: 31 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-xl bg-surface border border-border animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-5 sm:grid-cols-7 gap-1.5">
      {days.map((day) => {
        const isSelected = selectedDay === day.epochDay;
        const isAvailable = !day.claimed && !day.isToday;

        return (
          <button
            key={day.epochDay}
            onClick={() => isAvailable && onSelectDay(day.epochDay)}
            disabled={!isAvailable}
            className={`
              relative aspect-square rounded-xl flex flex-col items-center justify-center
              text-center transition-all duration-150 border
              ${day.isToday
                ? 'bg-accent/10 border-accent/30 ring-1 ring-accent/20'
                : day.claimed
                  ? 'bg-surface border-border opacity-60'
                  : isSelected
                    ? 'bg-accent/15 border-accent shadow-sm shadow-accent/10'
                    : 'bg-surface border-border hover:border-accent/30 hover:bg-surface-hover cursor-pointer active:scale-95'
              }
            `}
          >
            <span className="text-[10px] leading-none text-muted">{day.label}</span>

            {day.isToday ? (
              <span className="text-[9px] font-bold text-accent mt-0.5">TODAY</span>
            ) : day.claimed ? (
              <div className="mt-0.5">
                {day.farcasterPfp ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={day.farcasterPfp}
                      alt=""
                      className="w-5 h-5 rounded-full border border-accent/20 mx-auto"
                    />
                    <span className="text-[8px] text-muted truncate block w-full mt-0.5">
                      {day.farcasterUsername}
                    </span>
                  </>
                ) : (
                  <span className="text-[9px] text-muted">
                    {day.incentiveSol ? `${day.incentiveSol} SOL` : 'Taken'}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-[9px] text-accent/50 mt-0.5">Open</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
