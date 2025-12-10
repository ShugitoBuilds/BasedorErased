import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic'; // Ensure no caching for cron

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
        // We NEED author_username to reconstruct URLs for self-healing short hashes
        const { data: activeMarkets, error: fetchError } = await supabase
            .from('market_index')
            .select('market_id, cast_hash, author_username')
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

        const updates: any[] = [];

        // 4. Separate Short vs Valid Hashes
        // Short hashes (e.g. 0x847372fe) need "Healing" via URL fetch.
        // Valid hashes (40+ chars) can be batch processed.
        const shortHashMarkets = activeMarkets.filter(m => m.cast_hash.length < 20);
        const validHashMarkets = activeMarkets.filter(m => m.cast_hash.length >= 20);

        // --- A. Heal Short Hashes (Singular Fetch) ---
        if (shortHashMarkets.length > 0) {
            console.log(`[Cron:Sync] Healing ${shortHashMarkets.length} short-hash markets...`);

            for (const market of shortHashMarkets) {
                try {
                    // Javascript timestamp for cache busting + internal logging
                    const startFetch = Date.now();

                    // Reconstruct URL: https://warpcast.com/username/hash
                    const castUrl = `https://warpcast.com/${market.author_username}/${market.cast_hash}`;

                    const neynarRes = await fetch(
                        `https://api.neynar.com/v2/farcaster/cast?identifier=${encodeURIComponent(castUrl)}&type=url`,
                        { headers: { 'api_key': NEYNAR_API_KEY, 'accept': 'application/json' } }
                    );

                    if (!neynarRes.ok) {
                        console.warn(`[Cron:Sync] Failed to heal market ${market.market_id}: ${neynarRes.status}`);
                        continue;
                    }

                    const data = await neynarRes.json();
                    const cast = data.cast;

                    if (cast) {
                        const count = cast.reactions.likes_count ?? cast.reactions.likes?.length ?? 0;
                        console.log(`[Cron:Sync] Healed Market ${market.market_id}: ${count} likes. Full Hash: ${cast.hash}`);

                        updates.push({
                            market_id: market.market_id,
                            likes_count: count,
                            cast_hash: cast.hash // UPDATE TO FULL HASH TO FIX FUTURE SYNCS!
                        });
                    }
                } catch (err) {
                    console.error(`[Cron:Sync] Error healing market ${market.market_id}:`, err);
                }
            }
        }

        // --- B. Batch Process Valid Hashes ---
        if (validHashMarkets.length > 0) {
            const BATCH_SIZE = 50;
            console.log(`[Cron:Sync] Batch syncing ${validHashMarkets.length} valid markets...`);

            for (let i = 0; i < validHashMarkets.length; i += BATCH_SIZE) {
                const batch = validHashMarkets.slice(i, i + BATCH_SIZE);
                const hashes = batch.map(m => m.cast_hash).join(',');

                const neynarRes = await fetch(`https://api.neynar.com/v2/farcaster/casts?casts=${hashes}`, {
                    headers: { 'api_key': NEYNAR_API_KEY }
                });

                if (!neynarRes.ok) {
                    console.error(`[Cron:Sync] Neynar Batch Error (${i}):`, await neynarRes.text());
                    continue;
                }

                const neynarData = await neynarRes.json();
                const casts = neynarData.result?.casts || [];

                for (const cast of casts) {
                    const count = cast.reactions.likes_count ?? cast.reactions.likes?.length ?? 0;

                    // Match back to market_id
                    const match = validHashMarkets.find(m => m.cast_hash === cast.hash);
                    if (match) {
                        updates.push({
                            market_id: match.market_id,
                            likes_count: count
                            // No need to update cast_hash
                        });
                    }
                }
            }
        }

        // 5. Bulk Update Supabase
        if (updates.length > 0) {
            console.log(`[Cron:Sync] Updating ${updates.length} records in Supabase...`);
            const { error: updateError } = await supabase
                .from('market_index')
                .upsert(updates, { onConflict: 'market_id', ignoreDuplicates: false });

            if (updateError) throw updateError;
        }

        const duration = Date.now() - startTime;
        console.log(`[Cron:Sync] Success. Synced ${updates.length} markets (Healed: ${shortHashMarkets.length}) in ${duration}ms.`);

        return NextResponse.json({
            success: true,
            synced: updates.length,
            healed: shortHashMarkets.length,
            total_active: activeMarkets.length,
            duration_ms: duration
        });

    } catch (err: any) {
        console.error('[Cron:Sync] Critical Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
