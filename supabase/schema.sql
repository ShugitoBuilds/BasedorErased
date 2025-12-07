-- Create table for storing cast snapshots
-- This protects against "Deleted Cast" exploits by preserving the initial state

CREATE TABLE IF NOT EXISTS cast_snapshots (
  cast_hash TEXT PRIMARY KEY,
  market_id BIGINT NOT NULL,
  author_fid BIGINT NOT NULL,
  text TEXT,
  embeds JSONB,
  snapshot_data JSONB, -- Full Neynar API response for future proofing
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for quick lookups by market_id
CREATE INDEX IF NOT EXISTS idx_cast_snapshots_market_id ON cast_snapshots(market_id);

-- Example RLS Policy (Optional, if we want public read access)
ALTER TABLE cast_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
ON cast_snapshots
FOR SELECT
TO public
USING (true);

-- Only Service Role can insert (which our API uses)
CREATE POLICY "Service Role only insert"
ON cast_snapshots
FOR INSERT
TO service_role
WITH CHECK (true);
