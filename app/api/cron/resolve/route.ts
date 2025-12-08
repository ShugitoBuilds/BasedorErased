import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import contractABI from '@/lib/contractABI.json';
import { supabase } from '@/lib/supabaseClient';

// --- CONFIG ---
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;

// Outcome enum matching contract
const Outcome = {
    UNRESOLVED: 0,
    MOON: 1,  // BASED - hit the threshold
    DOOM: 2,  // ERASED - missed the threshold
} as const;

// --- OPTIMIZATION CONSTANTS ---
const FAST_PATH_LIKES_THRESHOLD = 300; // If total likes > 300, it's automatically MOON (Cost: 1 API call)
const POWER_USER_THRESHOLD = 0.7;      // Neynar Score > 0.7 = Power User
const SCORE_CACHE_DAYS = 7;            // Refresh score if older than 7 days

// Initialize Viem Clients
const account = privateKeyToAccount(DEPLOYER_PRIVATE_KEY);

const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
});

const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(),
});

/**
 * Verify CRON_SECRET from request
 */
function verifyCronSecret(req: NextRequest): boolean {
    const authHeader = req.headers.get('authorization');
    if (authHeader === `Bearer ${CRON_SECRET}`) return true;

    const url = new URL(req.url);
    if (url.searchParams.get('secret') === CRON_SECRET) return true;

    if (!CRON_SECRET) {
        console.warn('[Oracle] CRON_SECRET not configured, skipping auth');
        return true;
    }
    return false;
}

/**
 * Extract cast identifier from URL
 */
function extractCastIdentifier(castUrl: string): string | null {
    try {
        const hashMatch = castUrl.match(/\/0x([a-fA-F0-9]+)$/);
        if (hashMatch) return `0x${hashMatch[1]}`;

        const shortMatch = castUrl.match(/\/([a-zA-Z0-9]+)$/);
        if (shortMatch) return shortMatch[1];

        if (castUrl.startsWith('0x')) return castUrl;

        return castUrl;
    } catch {
        return castUrl;
    }
}

/**
 * Fetch Power Likes with Optimizations (Fast Path + Caching)
 */
async function getPowerLikes(castUrl: string): Promise<number> {
    if (!NEYNAR_API_KEY) {
        console.warn('[Oracle] No NEYNAR_API_KEY, returning mock likes');
        return 0;
    }

    try {
        let identifier = extractCastIdentifier(castUrl) || castUrl;

        // 1. Resolve Cast to get Hash AND Total Likes (Fast Path Check)
        const resolveUrl = `https://api.neynar.com/v2/farcaster/cast?identifier=${encodeURIComponent(identifier)}&type=${identifier.startsWith('0x') ? 'hash' : 'url'}`;

        const resolveRes = await fetch(resolveUrl, { headers: { 'api_key': NEYNAR_API_KEY } });

        if (!resolveRes.ok) {
            console.error(`[Oracle] Resolve Error for ${castUrl}: ${await resolveRes.text()}`);
            return 0; // Can't resolve
        }

        const resolveData = await resolveRes.json();
        const cast = resolveData.cast;

        if (!cast) return 0;

        const hash = cast.hash;
        const totalLikes = cast.reactions.likes_count || 0;

        // --- FAST PATH ---
        if (totalLikes >= FAST_PATH_LIKES_THRESHOLD) {
            console.log(`[Oracle] ⚡ FAST PATH: ${totalLikes} total likes > ${FAST_PATH_LIKES_THRESHOLD}. Returning success.`);
            return totalLikes; // Return total likes (which is >= threshold)
        }

        console.log(`[Oracle] 🐢 Slow Path: ${totalLikes} likes. Counting Power Users...`);

        // --- SLOW PATH: Count Power Users ---
        let powerLikes = 0;
        let cursor: string | null = null;
        const MAX_PAGES = 10;
        let page = 0;

        do {
            const params = new URLSearchParams({
                hash: hash,
                types: 'likes',
                limit: '100',
            });
            if (cursor) params.append('cursor', cursor);

            const res = await fetch(
                `https://api.neynar.com/v2/farcaster/reactions/cast?${params.toString()}`,
                { headers: { 'api_key': NEYNAR_API_KEY } }
            );

            if (!res.ok) break;

            const data = await res.json();
            const reactions = data.reactions || [];

            if (reactions.length === 0) break;

            const fids = reactions.map((r: any) => r.user.fid);

            // --- CACHE LOOKUP ---
            const { data: cachedScores } = await supabase
                .from('user_scores')
                .select('fid, score, last_updated')
                .in('fid', fids);

            const cachedMap = new Map(cachedScores?.map((s: any) => [s.fid, s]) || []);
            const fidsToFetch: number[] = [];

            for (const fid of fids) {
                const cached = cachedMap.get(fid);
                let hitCache = false;

                if (cached) {
                    const daysDiff = (Date.now() - new Date(cached.last_updated).getTime()) / (1000 * 3600 * 24);
                    if (daysDiff < SCORE_CACHE_DAYS) {
                        hitCache = true;
                        if (Number(cached.score) > POWER_USER_THRESHOLD) powerLikes++;
                    }
                }

                if (!hitCache) fidsToFetch.push(fid);
            }

            // --- BATCH FETCH NEW/STALE USERS ---
            if (fidsToFetch.length > 0) {
                // Fetch in chunks of 100 max (Neynar limit)
                for (let i = 0; i < fidsToFetch.length; i += 100) {
                    const batch = fidsToFetch.slice(i, i + 100);
                    const userRes = await fetch(
                        `https://api.neynar.com/v2/farcaster/user/bulk?fids=${batch.join(',')}`,
                        { headers: { 'api_key': NEYNAR_API_KEY } }
                    );

                    if (userRes.ok) {
                        const userData = await userRes.json();
                        const users = userData.users || [];
                        const upsertRows = [];

                        for (const user of users) {
                            const score = user.score || user.experimental?.neynar_user_score || 0;
                            if (score > POWER_USER_THRESHOLD) powerLikes++;

                            upsertRows.push({
                                fid: user.fid,
                                score: score,
                                last_updated: new Date().toISOString()
                            });
                        }

                        // Async update cache (fire and forget)
                        if (upsertRows.length > 0) {
                            supabase.from('user_scores').upsert(upsertRows).then(({ error }) => {
                                if (error) console.error('[Oracle] Cache Upsert Error:', error);
                            });
                        }
                    }
                }
            }

            cursor = data.next?.cursor || null;
            page++;
            if (page >= MAX_PAGES) break;

        } while (cursor);

        return powerLikes;

    } catch (err: any) {
        console.error(`[Oracle] Error calculation:`, err);
        return 0;
    }
}

/**
 * Resolve a single market on-chain
 */
async function resolveMarket(marketId: number, outcome: number): Promise<string | null> {
    try {
        const txHash = await walletClient.writeContract({
            address: CONTRACT_ADDRESS,
            abi: contractABI,
            functionName: 'resolveMarket',
            args: [BigInt(marketId), outcome],
        });

        console.log(`[Oracle] Market #${marketId} resolved with tx: ${txHash}`);
        return txHash;
    } catch (err: any) {
        // console.error(`[Oracle] Failed to resolve market #${marketId}:`, err.message);
        return null;
    }
}

interface MarketResult {
    marketId: number;
    status: 'resolved' | 'pending' | 'skipped' | 'error';
    outcome?: string;
    likes?: number;
    threshold?: number;
    txHash?: string;
    error?: string;
}

export async function GET(req: NextRequest) {
    const startTime = Date.now();
    const results: MarketResult[] = [];
    const createResponse = (data: any) => NextResponse.json(data, { status: 200 });

    try {
        console.log('[Oracle] === Starting Resolution Cron ===');

        if (!verifyCronSecret(req)) {
            return createResponse({ success: false, error: 'Unauthorized' });
        }

        const nextMarketId = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: contractABI,
            functionName: 'nextMarketId',
        }) as bigint;

        const totalMarkets = Number(nextMarketId) - 1;
        if (totalMarkets < 1) return createResponse({ success: true, processed: 0 });

        const now = Math.floor(Date.now() / 1000);
        let resolvedCount = 0;
        let pendingCount = 0;
        let errorCount = 0;

        for (let id = 1; id <= totalMarkets; id++) {
            try {
                const market = await publicClient.readContract({
                    address: CONTRACT_ADDRESS,
                    abi: contractABI,
                    functionName: 'getMarket',
                    args: [BigInt(id)],
                }) as any;

                if (market.resolved) {
                    results.push({ marketId: id, status: 'skipped' });
                    continue;
                }

                const deadline = Number(market.deadline);
                const threshold = Number(market.threshold);
                const castUrl = market.castUrl;

                const likes = await getPowerLikes(castUrl);

                let shouldResolve = false;
                let outcome: number = Outcome.UNRESOLVED;
                let outcomeStr = '';

                if (likes >= threshold) {
                    outcome = Outcome.MOON;
                    outcomeStr = 'BASED';
                    shouldResolve = true;
                } else if (now > deadline) {
                    outcome = Outcome.DOOM;
                    outcomeStr = 'ERASED';
                    shouldResolve = true;
                } else {
                    pendingCount++;
                    results.push({ marketId: id, status: 'pending', likes, threshold });
                    continue;
                }

                if (likes === 0) {
                    const { data: snapshot } = await supabase
                        .from('cast_snapshots')
                        .select('*')
                        .eq('market_id', id)
                        .single();
                    if (snapshot) {
                        outcome = Outcome.DOOM;
                        outcomeStr = 'ERASED (Deleted)';
                        shouldResolve = true;
                    }
                }

                if (shouldResolve) {
                    const txHash = await resolveMarket(id, outcome);
                    if (txHash) {
                        resolvedCount++;
                        results.push({ marketId: id, status: 'resolved', outcome: outcomeStr, txHash });
                    } else {
                        errorCount++;
                        results.push({ marketId: id, status: 'error', error: 'Tx failed' });
                    }
                }

            } catch (err: any) {
                errorCount++;
                results.push({ marketId: id, status: 'error', error: err.message });
            }
            await new Promise(resolve => setTimeout(resolve, 100)); // Rate limit buffer
        }

        const duration = Date.now() - startTime;
        return createResponse({
            success: true,
            processed: totalMarkets,
            resolved: resolvedCount,
            pending: pendingCount,
            errors: errorCount,
            duration: `${duration}ms`,
            results,
        });

    } catch (error: any) {
        return createResponse({ success: false, error: error.message });
    }
}

export async function POST(req: NextRequest) {
    return GET(req);
}
