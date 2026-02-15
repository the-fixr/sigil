import { ImageResponse } from 'next/og';
import { supabase } from '@/lib/supabase';
import { getCurrentEpochDay } from '@/lib/solana';

export const dynamic = 'force-dynamic';

export async function GET() {
  const today = getCurrentEpochDay();

  // Get today's claim
  let advertiser = 'No one yet';
  let pfpUrl = '';
  let checkInCount = 0;
  let billboardImageUrl = '';
  let incentiveSol = '0';

  try {
    const { data: claim } = await supabase
      .from('day_claims')
      .select('*')
      .eq('epoch_day', today)
      .single();

    if (claim) {
      advertiser = claim.farcaster_username || claim.claimer_wallet?.slice(0, 8) + '...';
      pfpUrl = claim.farcaster_pfp_url || '';
      billboardImageUrl = claim.image_url || '';
      incentiveSol = ((claim.incentive_lamports || 0) / 1e9).toFixed(2);
    }

    const { count } = await supabase
      .from('check_ins')
      .select('*', { count: 'exact', head: true })
      .eq('epoch_day', today);
    checkInCount = count || 0;
  } catch { /* use defaults */ }

  // If there's an uploaded billboard image, redirect to it
  if (billboardImageUrl) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: billboardImageUrl,
        'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=60',
      },
    });
  }

  // Otherwise generate a default OG image
  let fontData: ArrayBuffer | null = null;
  try {
    const fontRes = await fetch(
      'https://fonts.gstatic.com/s/spacegrotesk/v16/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj62UUsjNsFjTDJK.woff'
    );
    if (fontRes.ok) fontData = await fontRes.arrayBuffer();
  } catch { /* fallback */ }

  const fontFamily = fontData ? 'Space Grotesk' : 'sans-serif';
  const dateStr = new Date(today * 86400 * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(145deg, #0a0f1a 0%, #1a1040 50%, #0a0f1a 100%)',
          fontFamily,
          color: 'white',
          padding: 60,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 40 }}>
          <span style={{ fontSize: 72, fontWeight: 800, color: '#a78bfa', letterSpacing: -2 }}>
            SIGIL
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'rgba(167, 139, 250, 0.1)',
            border: '2px solid rgba(167, 139, 250, 0.3)',
            borderRadius: 24,
            padding: '24px 40px',
            marginBottom: 30,
          }}
        >
          {pfpUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pfpUrl}
              alt=""
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                marginRight: 24,
                border: '3px solid rgba(167, 139, 250, 0.5)',
              }}
            />
          ) : (
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                marginRight: 24,
                backgroundColor: 'rgba(167, 139, 250, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 36,
              }}
            >
              ?
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
              Today&apos;s Advertiser
            </span>
            <span style={{ fontSize: 32, fontWeight: 700 }}>{advertiser}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 40 }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '16px 32px',
              backgroundColor: 'rgba(167, 139, 250, 0.08)',
              borderRadius: 16,
              border: '1px solid rgba(167, 139, 250, 0.2)',
            }}
          >
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>Check-ins</span>
            <span style={{ fontSize: 36, fontWeight: 700, color: '#a78bfa' }}>{checkInCount}</span>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '16px 32px',
              backgroundColor: 'rgba(167, 139, 250, 0.08)',
              borderRadius: 16,
              border: '1px solid rgba(167, 139, 250, 0.2)',
            }}
          >
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>Pool</span>
            <span style={{ fontSize: 24, fontWeight: 600 }}>{incentiveSol} SOL</span>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '16px 32px',
              backgroundColor: 'rgba(167, 139, 250, 0.08)',
              borderRadius: 16,
              border: '1px solid rgba(167, 139, 250, 0.2)',
            }}
          >
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>Date</span>
            <span style={{ fontSize: 24, fontWeight: 600 }}>{dateStr}</span>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 40,
            fontSize: 16,
            color: 'rgba(255,255,255,0.3)',
          }}
        >
          Billboard NFT &middot; 10,000 editions &middot; sigil.bond
        </div>
      </div>
    ),
    {
      width: 800,
      height: 800,
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=60',
      },
      ...(fontData
        ? {
            fonts: [
              {
                name: 'Space Grotesk',
                data: fontData,
                style: 'normal' as const,
                weight: 700 as const,
              },
            ],
          }
        : {}),
    }
  );
}
