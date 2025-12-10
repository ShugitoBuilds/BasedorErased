import * as dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY;

if (!SUPABASE_URL || !NEYNAR_API_KEY) {
    console.error('Missing Env Vars');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function cleanHash(input: string): string {
    // If it's a URL, try to extract the last segment
    if (input.startsWith('http')) {
        const parts = input.split('/');
        return parts[parts.length - 1]; // "0x847372fe"
    }
    return input;
}

async function repairHashes() {
    console.log('--- Starting Hash Repair (Smart) ---');

    // 1. Fetch Active Markets
    const { data: markets, error } = await supabase
        .from('market_index')
        .select('market_id, cast_hash, author_username')
        .eq('status', 'active');

    if (error || !markets) return console.error('DB Error:', error);

    // Filter for things that look "wrong" (Short hash OR URL-like)
    // A proper hash is 0x + 40 chars = 42 chars.
    const targets = markets.filter(m => m.cast_hash.length < 30 || m.cast_hash.startsWith('http'));

    console.log(`Found ${markets.length} active markets.`);
    console.log(`-> ${targets.length} need repair.`);

    for (const market of targets) {
        try {
            console.log(`\nProcessing Market ID: ${market.market_id}`);
            console.log(`  Current Hash/URL: ${market.cast_hash}`);

            // 1. Clean identifier
            const shortIdentifier = cleanHash(market.cast_hash);
            console.log(`  Cleaned Identifier: ${shortIdentifier}`);

            // 2. Construct Canonical Warpcast URL
            // This is the most reliable way to resolve via Neynar
            const canonicalUrl = `https://warpcast.com/${market.author_username}/${shortIdentifier}`;
            console.log(`  Canonical URL: ${canonicalUrl}`);

            // 3. Fetch Full Data
            const res = await fetch(
                `https://api.neynar.com/v2/farcaster/cast?identifier=${encodeURIComponent(canonicalUrl)}&type=url`,
                { headers: { 'api_key': NEYNAR_API_KEY, 'accept': 'application/json' } }
            );

            if (!res.ok) {
                console.error(`  [X] Neynar 404/Error: ${res.status}`);
                continue;
            }

            const data = await res.json();
            const cast = data.cast;

            if (cast && cast.hash) {
                console.log(`  [✓] FOUND FULL HASH: ${cast.hash}`);

                // 4. Update DB
                const { error: updateError } = await supabase
                    .from('market_index')
                    .update({
                        cast_hash: cast.hash,
                        likes_count: cast.reactions?.likes_count || 0
                    })
                    .eq('market_id', market.market_id);

                if (updateError) console.error('  [X] DB Update Failed:', updateError);
                else console.log('  [✓] DB Updated.');
            }

        } catch (err: any) {
            console.error(`  [X] Error: ${err.message}`);
        }
    }
    console.log('\n--- Done ---');
}

repairHashes();
