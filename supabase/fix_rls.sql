-- Enable RLS on all flagged tables
ALTER TABLE public.roasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roast_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cast_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_scores ENABLE ROW LEVEL SECURITY;

-- Create Policies for Tables (assuming Public Read is required for game mechanics)

-- Roasts (Policies already exist per error message, so just RLS enabled above is enough for the error)

-- Seasons
CREATE POLICY "Enable read access for all users" ON "public"."seasons"
AS PERMISSIVE FOR SELECT TO public USING (true);

-- Players
CREATE POLICY "Enable read access for all users" ON "public"."players"
AS PERMISSIVE FOR SELECT TO public USING (true);

-- Attacks
CREATE POLICY "Enable read access for all users" ON "public"."attacks"
AS PERMISSIVE FOR SELECT TO public USING (true);

-- Roast Logs (Maybe internal? But safe to allow read if it was public before)
CREATE POLICY "Enable read access for all users" ON "public"."roast_logs"
AS PERMISSIVE FOR SELECT TO public USING (true);

-- Cast Snapshots
CREATE POLICY "Enable read access for all users" ON "public"."cast_snapshots"
AS PERMISSIVE FOR SELECT TO public USING (true);

-- User Scores
CREATE POLICY "Enable read access for all users" ON "public"."user_scores"
AS PERMISSIVE FOR SELECT TO public USING (true);
