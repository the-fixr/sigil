import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

/** Lazy-init Supabase client (anon key, for reads) */
export const supabase = {
  get client() {
    if (!_supabase) {
      _supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
    }
    return _supabase;
  },
  from(table: string) {
    return this.client.from(table);
  },
  get storage() {
    return this.client.storage;
  },
};

// Server-side client with service key for writes
export function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) throw new Error('Supabase env vars not set');
  return createClient(url, serviceKey);
}

// Types matching our Supabase tables
export interface DayClaimRow {
  epoch_day: number;
  claimer_wallet: string;
  image_url?: string;
  incentive_lamports: number;
  total_weight: number;
  farcaster_username?: string;
  farcaster_pfp_url?: string;
  farcaster_fid?: number;
  claimed_at: string;
}

export interface CheckInRow {
  id?: number;
  epoch_day: number;
  wallet: string;
  weight: number;
  checked_in_at: string;
}

export interface RewardLedgerRow {
  id?: number;
  epoch_day: number;
  wallet: string;
  amount_lamports: number;
  tx_signature?: string;
  status: 'pending' | 'sent' | 'failed';
  created_at: string;
}

export interface NftMintRow {
  mint_address: string;
  owner_wallet: string;
  token_id: number;
  minted_at: string;
}
