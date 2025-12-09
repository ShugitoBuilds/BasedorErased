import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// --- CONFIG ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY!;
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
    const startTime = Date.now();
    console.log('[Cron:Sync] Starting execution...');

    // 1. Security Check
    const authHeader = req.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        console.warn('[Cron:Sync] Unauthorized attempt');
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

        if (fetchError) {
            console.error('[Cron:Sync] Supabase Fetch Error:', fetchError);
            return NextResponse.json({ error: fetchError.message }, { status: 500 });
        }

        if (!activeMarkets || activeMarkets.length === 0) {
            console.log('[Cron:Sync] No active markets found. Exiting.');
            return NextResponse.json({ message: 'No active markets to sync' });
        }

        console.log(`[Cron:Sync] Found ${activeMarkets.length} active markets. Processing...`);

        // 4. Batch Processing (Neynar limit is usually 50-100)
        const BATCH_SIZE = 50;
        const updates = [];

        for (let i = 0; i < activeMarkets.length; i += BATCH_SIZE) {
            const batch = activeMarkets.slice(i, i + BATCH_SIZE);
            const hashes = batch.map(m => m.cast_hash).join(',');

            console.log(`[Cron:Sync] Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} items)`);

            // 4a. Call Neynar
            const neynarRes = await fetch(`https://api.neynar.com/v2/farcaster/casts?casts=${hashes}`, {
                headers: { 'api_key': NEYNAR_API_KEY }
            });

            if (!neynarRes.ok) {
                console.error(`[Cron:Sync] Neynar API Error (${neynarRes.status}):`, await neynarRes.text());
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
                });
            }
        }

        // 5. Bulk Update Supabase
        // Map updates to include market_id
        const updatesWithId = updates.map(u => {
            const match = activeMarkets.find(m => m.cast_hash === u.cast_hash);
            return match ? { market_id: match.market_id, likes_count: u.likes_count } : null;
        }).filter(u => u !== null);

        if (updatesWithId.length > 0) {
            console.log(`[Cron:Sync] Updating ${updatesWithId.length} records in Supabase...`);
            const { error: updateError } = await supabase
                .from('market_index')
                .upsert(updatesWithId, { onConflict: 'market_id', ignoreDuplicates: false });

            if (updateError) throw updateError;
        }

        const duration = Date.now() - startTime;
        console.log(`[Cron:Sync] Success. Synced ${updatesWithId.length} markets in ${duration}ms.`);

        return NextResponse.json({
            success: true,
            synced: updatesWithId.length,
            total_active: activeMarkets.length,
            duration_ms: duration
        });

    } catch (err: any) {
        console.error('[Cron:Sync] Critical Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
