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
        // Valid hashes (40+ chars) are now handled by the SCRAPER CRON.
        const shortHashMarkets = activeMarkets.filter(m => m.cast_hash.length < 20);

        // --- A. Heal Short Hashes (Singular Fetch) ---
        // We MUST fix short hashes so the Scraper can find the correct URL.
        if (shortHashMarkets.length > 0) {
            console.log(`[Cron:Sync] Healing ${shortHashMarkets.length} short-hash markets...`);

            for (const market of shortHashMarkets) {
                try {
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
                        console.log(`[Cron:Sync] Healed Market ${market.market_id}. Full Hash: ${cast.hash}`);

                        updates.push({
                            market_id: market.market_id,
                            // likes_count: count, // DISABLED: Handled by Scraper
                            cast_hash: cast.hash // UPDATE TO FULL HASH TO FIX SCRAPER!
                        });
                    }
                } catch (err) {
                    console.error(`[Cron:Sync] Error healing market ${market.market_id}:`, err);
                }
            }
        }

        // --- B. Batch Process Valid Hashes ---
        // DISABLED entirely to prevent conflict with Puppeteer Scraper.
        // The Scraper is now the Sole Source of Truth for Score Updates.

        // 5. Bulk Update Supabase
        if (updates.length > 0) {
            console.log(`[Cron:Sync] Updating ${updates.length} records in Supabase...`);
            const { error: updateError } = await supabase
                .from('market_index')
                .upsert(updates, { onConflict: 'market_id', ignoreDuplicates: false });

            if (updateError) throw updateError;
        }

        const duration = Date.now() - startTime;
        console.log(`[Cron:Sync] Success. Synced/Healed ${updates.length} markets in ${duration}ms.`);

        return NextResponse.json({
            success: true,
            synced: updates.length,
            healed: shortHashMarkets.length,
            total_active: activeMarkets.length,
            mode: 'healing_only', // Flag to show we aren't syncing scores
            duration_ms: duration
        });

    } catch (err: any) {
        console.error('[Cron:Sync] Critical Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
