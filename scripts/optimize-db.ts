import { Client } from 'pg';

const connectionString = 'postgres://postgres.umjxdkdbhkkcarpitkku:Deepblue%40567890%21%40%23@aws-1-us-east-2.pooler.supabase.com:6543/postgres';

const client = new Client({
    connectionString,
});

async function optimize() {
    try {
        console.log('Connecting to database...');
        await client.connect();

        console.log('--- 1. Optimizing Profiles RLS ---');
        // Based on schema inspection: PK is 'wallet_address'.
        // BUT 'auth.uid()' usually returns a UUID if using Supabase Auth.
        // If this app uses Custom Auth or Wallet-based Auth, then 'auth.uid()' might match 'wallet_address' 
        // OR we are mixing concepts.
        // IF 'profiles.wallet_address' stores the wallet, and the user is authenticated via SIWE (Supabase Auth built-in), 
        // then auth.uid() is a UUID.
        // We need to know if 'wallet_address' IS the auth.uid() or if there is a mapping.
        // HOWEVER, standard Supabase Auth often maps wallet to ID.
        // Let's assume for now that we use the `auth.jwt() ->> 'sub'` or check if `wallet_address` is used as the ID.
        // WARNING: If `auth.uid()` is a UUID and `wallet_address` is a 0x string, this policy will FAIL.

        // CHECK: Does strict RLS logic apply? 
        // "Users can update their own profile" usually implies id = auth.uid().
        // If columns don't have 'id', then maybe 'wallet_address' is NOT the PK joined to Auth?
        // Let's check if there is a 'user_id' column we missed? 
        // The previous output: wallet_address, matches_balance, last_daily_claim, league, current_score, shield_active_until, created_at, updated_at.
        // NO 'user_id'. 
        // This implies 'wallet_address' IS the identifier. 
        // If so, does auth.uid() return the wallet address? 
        // Only if using a specific wallet auth setup. 

        // SAFEST BET: Don't break it. 
        // The warning was: "re-evaluates current_setting()".
        // Use `(select auth.jwt() ->> 'sub')` or similar wrapper?
        // Actually, let's look at the EXISTING policy if possible? No easy way.
        // I will trust the standard fix but map it to `wallet_address`.
        // AND casting might be needed if types differ, but both likely text.

        /*
        CREATE POLICY "Users can update their own profile" 
        ON profiles 
        FOR UPDATE 
        USING ( wallet_address = (select auth.jwt() ->> 'sub') ); -- assuming sub has the wallet or ID
        */

        // actually, if we are using standard supabase auth with wallets, auth.uid() is a uuid.
        // If profiles doesn't have that UUID, we can't link them easily in RLS without a lookup table.
        // WAIT. If the table has NO link to auth.users, RLS based on auth.uid() is impossible unless wallet_address IS the ID.

        // DECISION: Skip the Profile RLS optimization for now to avoid breaking Auth. 
        // Focus on the Indices and Market Index cleanup which are safe.
        // I will log a warning.

        console.log('Skipping Profiles RLS (Ambiguous Schema mapping).');

        console.log('--- 2. Optimizing Market Index RLS ---');
        await client.query(`
            DROP POLICY IF EXISTS "Allow service role to all" ON market_index; 
            DROP POLICY IF EXISTS "Allow public read access" ON market_index;
            
            -- Recreate Clean Public Access
            CREATE POLICY "Allow public read access" 
            ON market_index 
            FOR SELECT 
            USING ( true );
        `);
        console.log('✓ Market Index policies updated.');

        console.log('--- 3. Adding Missing Indices ---');
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_attacks_attacker ON attacks(attacker_address);
            CREATE INDEX IF NOT EXISTS idx_attacks_victim ON attacks(victim_address);
            CREATE INDEX IF NOT EXISTS idx_game_actions_actor ON game_actions(actor_wallet);
            CREATE INDEX IF NOT EXISTS idx_game_actions_target ON game_actions(target_wallet);
        `);
        console.log('✓ Indices created.');

    } catch (err) {
        console.error('Optimization Failed:', err);
    } finally {
        await client.end();
    }
}

optimize();
