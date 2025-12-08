import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import contractABI from '@/lib/contractABI.json';
import { supabase } from '@/lib/supabaseClient';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
const CRON_SECRET = process.env.CRON_SECRET;

const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
});

/**
 * Verify CRON_SECRET from request
 */
function verifyCronSecret(req: NextRequest): boolean {
    const authHeader = req.headers.get('authorization');
    if (authHeader === `Bearer ${CRON_SECRET}`) {
        return true;
    }

    const url = new URL(req.url);
    const secretParam = url.searchParams.get('secret');
    if (secretParam === CRON_SECRET) {
        return true;
    }

    if (!CRON_SECRET) {
        console.warn('[Indexer] CRON_SECRET not configured, skipping auth');
        return true;
    }

    return false;
}

/**
 * Extract cast hash from URL
 */
function extractCastHash(castUrl: string): string | null {
    try {
        const hashMatch = castUrl.match(/\/0x([a-fA-F0-9]+)$/);
        if (hashMatch) {
            return `0x${hashMatch[1]}`;
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Fetch cast metadata from Neynar
 */
async function getCastMetadata(castUrl: string) {
    if (!NEYNAR_API_KEY) {
        return null;
    }

    try {
        const hash = extractCastHash(castUrl);
        if (!hash) {
            // Try to resolve URL to hash
            const resolveRes = await fetch(
                `https://api.neynar.com/v2/farcaster/cast?identifier=${encodeURIComponent(castUrl)}&type=url`,
                { headers: { 'api_key': NEYNAR_API_KEY } }
            );

            if (!resolveRes.ok) {
                console.error('[Indexer] Failed to resolve cast URL:', await resolveRes.text());
                return null;
            }

            const data = await resolveRes.json();
            const cast = data.cast;

            return {
                hash: cast.hash,
                author_username: cast.author?.username || 'unknown',
                author_pfp_url: cast.author?.pfp_url || null,
                text: cast.text || '',
            };
        }

        // Fetch by hash
        const res = await fetch(
            `https://api.neynar.com/v2/farcaster/cast?identifier=${hash}&type=hash`,
            { headers: { 'api_key': NEYNAR_API_KEY } }
        );

        if (!res.ok) {
            console.error('[Indexer] Failed to fetch cast:', await res.text());
            return null;
        }

        const data = await res.json();
        const cast = data.cast;

        return {
            hash: cast.hash,
            author_username: cast.author?.username || 'unknown',
            author_pfp_url: cast.author?.pfp_url || null,
            text: cast.text || '',
        };
    } catch (err) {
        console.error('[Indexer] Error fetching cast metadata:', err);
        return null;
    }
}

export async function GET(req: NextRequest) {
    const startTime = Date.now();

    try {
        console.log('[Indexer] === Starting Market Indexing ===');

        // Verify authorization
        if (!verifyCronSecret(req)) {
            console.error('[Indexer] Unauthorized request');
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        // Get total market count from blockchain
        const nextMarketId = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: contractABI,
            functionName: 'nextMarketId',
        }) as bigint;

        const totalMarkets = Number(nextMarketId) - 1;
        console.log(`[Indexer] Total markets on-chain: ${totalMarkets}`);

        if (totalMarkets < 1) {
            return NextResponse.json({
                success: true,
                message: 'No markets to index',
                indexed: 0,
            });
        }

        let indexedCount = 0;
        let updatedCount = 0;
        let errorCount = 0;

        // Iterate through all markets
        for (let id = 1; id <= totalMarkets; id++) {
            try {
                // Fetch market data from blockchain
                const market = await publicClient.readContract({
                    address: CONTRACT_ADDRESS,
                    abi: contractABI,
                    functionName: 'getMarket',
                    args: [BigInt(id)],
                }) as any;

                const castUrl = market.castUrl;
                const threshold = Number(market.threshold);
                const deadline = Number(market.deadline);
                const resolved = market.resolved;
                const outcome = Number(market.outcome);

                console.log(`[Indexer] Processing Market #${id}: ${castUrl}`);

                // Fetch cast metadata
                const castData = await getCastMetadata(castUrl);

                const status = resolved
                    ? (outcome === 1 ? 'based' : 'erased')
                    : 'active';

                // Upsert to database
                const { error } = await supabase
                    .from('market_index')
                    .upsert({
                        market_id: id,
                        cast_hash: castData?.hash || extractCastHash(castUrl) || castUrl,
                        cast_url: castUrl,
                        author_username: castData?.author_username || 'unknown',
                        author_pfp_url: castData?.author_pfp_url,
                        cast_text: castData?.text || '',
                        threshold,
                        deadline: new Date(deadline * 1000).toISOString(),
                        status,
                        outcome,
                        resolved,
                        updated_at: new Date().toISOString(),
                    }, {
                        onConflict: 'market_id'
                    });

                if (error) {
                    console.error(`[Indexer] Error upserting market #${id}:`, error);
                    errorCount++;
                } else {
                    indexedCount++;
                    console.log(`[Indexer] ✓ Indexed Market #${id}`);
                }

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));

            } catch (marketErr: any) {
                console.error(`[Indexer] Error processing market #${id}:`, marketErr.message);
                errorCount++;
            }
        }

        const duration = Date.now() - startTime;
        console.log(`[Indexer] === Completed in ${duration}ms ===`);
        console.log(`[Indexer] Indexed: ${indexedCount}, Errors: ${errorCount}`);

        return NextResponse.json({
            success: true,
            totalMarkets,
            indexed: indexedCount,
            errors: errorCount,
            duration: `${duration}ms`,
        });

    } catch (error: any) {
        console.error('[Indexer] Fatal error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Unknown error',
        }, { status: 500 });
    }
}

// POST handler for manual triggers
export async function POST(req: NextRequest) {
    return GET(req);
}
