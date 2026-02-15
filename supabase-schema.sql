-- Sigil v2 Supabase Schema
-- Run this in the Supabase SQL editor

-- Day claims table (v2: billboard model)
CREATE TABLE IF NOT EXISTS day_claims (
  epoch_day INTEGER PRIMARY KEY,
  claimer_wallet TEXT NOT NULL,
  image_url TEXT,
  incentive_lamports BIGINT NOT NULL DEFAULT 0,
  total_weight INTEGER NOT NULL DEFAULT 0,
  farcaster_username TEXT,
  farcaster_pfp_url TEXT,
  farcaster_fid INTEGER,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Check-ins table (holders check in daily to earn rewards)
CREATE TABLE IF NOT EXISTS check_ins (
  id BIGSERIAL PRIMARY KEY,
  epoch_day INTEGER NOT NULL,
  wallet TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 1,
  checked_in_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(epoch_day, wallet)
);

-- Reward ledger (tracks payouts to holders)
CREATE TABLE IF NOT EXISTS reward_ledger (
  id BIGSERIAL PRIMARY KEY,
  epoch_day INTEGER NOT NULL,
  wallet TEXT NOT NULL,
  amount_lamports BIGINT NOT NULL,
  tx_signature TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NFT mints table
CREATE TABLE IF NOT EXISTS nft_mints (
  mint_address TEXT PRIMARY KEY,
  owner_wallet TEXT NOT NULL,
  token_id INTEGER NOT NULL UNIQUE,
  minted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_day_claims_wallet ON day_claims(claimer_wallet);
CREATE INDEX IF NOT EXISTS idx_checkins_day ON check_ins(epoch_day);
CREATE INDEX IF NOT EXISTS idx_checkins_wallet ON check_ins(wallet);
CREATE INDEX IF NOT EXISTS idx_rewards_wallet ON reward_ledger(wallet);
CREATE INDEX IF NOT EXISTS idx_rewards_status ON reward_ledger(status);
CREATE INDEX IF NOT EXISTS idx_nft_mints_owner ON nft_mints(owner_wallet);
CREATE INDEX IF NOT EXISTS idx_nft_mints_token_id ON nft_mints(token_id);

-- Enable RLS
ALTER TABLE day_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE nft_mints ENABLE ROW LEVEL SECURITY;

-- Read-only policies for anon key (public reads)
CREATE POLICY "Public read day_claims" ON day_claims FOR SELECT USING (true);
CREATE POLICY "Public read check_ins" ON check_ins FOR SELECT USING (true);
CREATE POLICY "Public read reward_ledger" ON reward_ledger FOR SELECT USING (true);
CREATE POLICY "Public read nft_mints" ON nft_mints FOR SELECT USING (true);

-- Service key can do everything (writes come from server API routes)

-- Storage bucket for billboard images
-- Run in Supabase Dashboard > Storage > Create bucket:
--   Name: day-images
--   Public: true
--   File size limit: 1MB
--   Allowed MIME types: image/png, image/jpeg, image/webp
