import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// --- CONFIG ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY!;
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
    // 1. Security Check
    const authHeader = req.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Init Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    try {
        // 3. Fetch Active Markets
        const { data: activeMarkets, error: fetchError } = await supabase
            .from('market_index')
            .select('market_id, cast_hash')
            .eq('status', 'active');

        if (fetchError || !activeMarkets || activeMarkets.length === 0) {
            return NextResponse.json({ message: 'No active markets to sync', error: fetchError });
        }

        console.log(`Syncing active markets: ${activeMarkets.length}`);

        // 4. Batch Processing (Neynar limit is usually 50-100)
        const BATCH_SIZE = 50;
        const updates = [];

        for (let i = 0; i < activeMarkets.length; i += BATCH_SIZE) {
            const batch = activeMarkets.slice(i, i + BATCH_SIZE);
            const hashes = batch.map(m => m.cast_hash).join(',');

            // 4a. Call Neynar
            const neynarRes = await fetch(`https://api.neynar.com/v2/farcaster/casts?casts=${hashes}`, {
                headers: { 'api_key': NEYNAR_API_KEY }
            });

            if (!neynarRes.ok) {
                console.error(`Neynar Batch Error (${i}):`, await neynarRes.text());
                continue;
            }

            const neynarData = await neynarRes.json();
            const casts = neynarData.result?.casts || [];

            // 4b. Map results back to updates
            for (const cast of casts) {
                // Neynar V2 has likes_count. likes array is often limited.
                const count = cast.reactions.likes_count ?? cast.reactions.likes?.length ?? 0;

                updates.push({
                    cast_hash: cast.hash,
                    likes_count: count,
                    // We match by cast_hash since market_id might not be in Neynar response easily without map
                });
            }
        }

        // 5. Bulk Update Supabase
        // We need to update rows where cast_hash matches. 
        // Supabase `upsert` works if we have a unique constraint on cast_hash (we should).
        // If not, we iterate transfers.
        // Assuming cast_hash is unique or we have market_id mapped.

        // Better: Map updates to include market_id
        const updatesWithId = updates.map(u => {
            const match = activeMarkets.find(m => m.cast_hash === u.cast_hash);
            return match ? { market_id: match.market_id, likes_count: u.likes_count } : null;
        }).filter(u => u !== null);

        if (updatesWithId.length > 0) {
            const { error: updateError } = await supabase
                .from('market_index')
                .upsert(updatesWithId, { onConflict: 'market_id', ignoreDuplicates: false }); // ignoreDuplicates=false means update

            if (updateError) throw updateError;
        }

        return NextResponse.json({
            success: true,
            synced: updatesWithId.length,
            total_active: activeMarkets.length
        });

    } catch (err: any) {
        console.error('Sync Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
