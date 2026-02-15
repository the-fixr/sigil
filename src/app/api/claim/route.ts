import { NextRequest, NextResponse } from 'next/server';
import { getConnection, pollConfirmation } from '@/lib/solana';
import { getServiceClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const txSignature = formData.get('txSignature') as string;
    const epochDay = Number(formData.get('epochDay'));
    const incentiveLamports = Number(formData.get('incentiveLamports'));
    const farcasterUsername = (formData.get('farcasterUsername') as string) || null;
    const imageFile = formData.get('image') as File | null;

    if (!txSignature || !epochDay) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Confirm the on-chain transaction
    const connection = getConnection();
    await pollConfirmation(connection, txSignature);

    // Parse the TX to extract claimer wallet
    const tx = await connection.getParsedTransaction(txSignature, { maxSupportedTransactionVersion: 0 });
    if (!tx) return NextResponse.json({ error: 'Transaction not found' }, { status: 400 });

    const claimerWallet = tx.transaction.message.accountKeys[0].pubkey.toString();

    const supabase = getServiceClient();
    let imageUrl: string | null = null;

    // Upload image to Supabase Storage if provided
    if (imageFile && imageFile.size > 0) {
      const ext = imageFile.type === 'image/png' ? 'png' : 'jpg';
      const storagePath = `day-${epochDay}.${ext}`;
      const buffer = Buffer.from(await imageFile.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from('day-images')
        .upload(storagePath, buffer, {
          contentType: imageFile.type,
          upsert: true,
        });

      if (uploadError) {
        console.error('Image upload error:', uploadError);
      } else {
        const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        imageUrl = `${baseUrl}/storage/v1/object/public/day-images/${storagePath}`;
      }
    }

    // Resolve Farcaster PFP if username provided
    let farcasterPfpUrl: string | null = null;
    let farcasterFid: number | null = null;
    if (farcasterUsername) {
      try {
        const neynarKey = process.env.NEYNAR_API_KEY;
        if (neynarKey) {
          const username = farcasterUsername.replace(/^@/, '');
          const res = await fetch(
            `https://api.neynar.com/v2/farcaster/user/search?q=${encodeURIComponent(username)}&limit=1`,
            { headers: { accept: 'application/json', api_key: neynarKey } }
          );
          const data = await res.json();
          const user = data?.result?.users?.[0];
          if (user) {
            farcasterPfpUrl = user.pfp_url || null;
            farcasterFid = user.fid || null;
          }
        }
      } catch {
        // Non-critical
      }
    }

    // Store in Supabase
    const { error } = await supabase.from('day_claims').upsert(
      {
        epoch_day: epochDay,
        claimer_wallet: claimerWallet,
        image_url: imageUrl,
        incentive_lamports: incentiveLamports || 0,
        farcaster_username: farcasterUsername,
        farcaster_pfp_url: farcasterPfpUrl,
        farcaster_fid: farcasterFid,
        claimed_at: new Date().toISOString(),
      },
      { onConflict: 'epoch_day' }
    );

    if (error) {
      console.error('Supabase upsert error:', error);
      return NextResponse.json({ error: 'Failed to store claim' }, { status: 500 });
    }

    return NextResponse.json({ success: true, epochDay, imageUrl });
  } catch (error) {
    console.error('Claim error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
