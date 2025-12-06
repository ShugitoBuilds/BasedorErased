import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import contractABI from '@/lib/contractABI.json';

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
    // Check Authorization header
    const authHeader = req.headers.get('authorization');
    if (authHeader === `Bearer ${CRON_SECRET}`) {
        return true;
    }

    // Check query param (for Vercel Cron)
    const url = new URL(req.url);
    const secretParam = url.searchParams.get('secret');
    if (secretParam === CRON_SECRET) {
        return true;
    }

    // Skip validation in development if no secret configured
    if (!CRON_SECRET) {
        console.warn('[Oracle] CRON_SECRET not configured, skipping auth');
        return true;
    }

    return false;
}

/**
 * Extract cast identifier from URL
 * Handles various Warpcast URL formats
 */
function extractCastIdentifier(castUrl: string): string | null {
    try {
        // Try to extract hash from URL like "https://warpcast.com/user/0xabc123"
        const hashMatch = castUrl.match(/\/0x([a-fA-F0-9]+)$/);
        if (hashMatch) {
            return `0x${hashMatch[1]}`;
        }

        // Try to extract from short format like "https://warpcast.com/user/abc123def"
        const shortMatch = castUrl.match(/\/([a-zA-Z0-9]+)$/);
        if (shortMatch) {
            return shortMatch[1];
        }

        // If it's already a hash, return as-is
        if (castUrl.startsWith('0x')) {
            return castUrl;
        }

        return castUrl;
    } catch {
        return castUrl;
    }
}

/**
 * Fetch cast likes from Neynar API
 */
async function getCastLikes(castUrl: string): Promise<number> {
    if (!NEYNAR_API_KEY) {
        console.warn('[Oracle] No NEYNAR_API_KEY, returning mock likes');
        return 0;
    }

    try {
        const identifier = extractCastIdentifier(castUrl);
        if (!identifier) {
            console.error(`[Oracle] Could not extract identifier from: ${castUrl}`);
            return 0;
        }

        // Try URL-based lookup first
        let response = await fetch(
            `https://api.neynar.com/v2/farcaster/cast?identifier=${encodeURIComponent(castUrl)}&type=url`,
            {
                headers: { 'api_key': NEYNAR_API_KEY },
            }
        );

        // If URL lookup fails, try hash-based lookup
        if (!response.ok && identifier.startsWith('0x')) {
            response = await fetch(
                `https://api.neynar.com/v2/farcaster/cast?identifier=${identifier}&type=hash`,
                {
                    headers: { 'api_key': NEYNAR_API_KEY },
                }
            );
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Oracle] Neynar API error for ${castUrl}:`, errorText);
            return 0;
        }

        const data = await response.json();

        if (data.cast) {
            // Neynar v2 returns likes in reactions object
            const likesCount = data.cast.reactions?.likes_count ??
                               data.cast.reactions?.likes?.length ??
                               0;
            return likesCount;
        }

        return 0;
    } catch (err) {
        console.error(`[Oracle] Error fetching likes for ${castUrl}:`, err);
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
        console.error(`[Oracle] Failed to resolve market #${marketId}:`, err.message);
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

    // Always return 200 to prevent cron retry spam
    const createResponse = (data: any) => NextResponse.json(data, { status: 200 });

    try {
        console.log('[Oracle] === Starting Resolution Cron ===');

        // 1. Verify CRON_SECRET
        if (!verifyCronSecret(req)) {
            console.error('[Oracle] Unauthorized request');
            return createResponse({
                success: false,
                error: 'Unauthorized',
            });
        }

        // 2. Get total market count
        const nextMarketId = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: contractABI,
            functionName: 'nextMarketId',
        }) as bigint;

        const totalMarkets = Number(nextMarketId) - 1;
        console.log(`[Oracle] Total markets: ${totalMarkets}`);

        if (totalMarkets < 1) {
            return createResponse({
                success: true,
                message: 'No markets to process',
                processed: 0,
                resolved: 0,
            });
        }

        const now = Math.floor(Date.now() / 1000);
        let resolvedCount = 0;
        let pendingCount = 0;
        let errorCount = 0;

        // 3. Iterate through all markets
        for (let id = 1; id <= totalMarkets; id++) {
            try {
                // Fetch market data
                const market = await publicClient.readContract({
                    address: CONTRACT_ADDRESS,
                    abi: contractABI,
                    functionName: 'getMarket',
                    args: [BigInt(id)],
                }) as any;

                // Skip already resolved markets
                if (market.resolved) {
                    results.push({
                        marketId: id,
                        status: 'skipped',
                    });
                    continue;
                }

                const deadline = Number(market.deadline);
                const threshold = Number(market.threshold);
                const castUrl = market.castUrl;

                console.log(`[Oracle] Checking Market #${id}: ${threshold} likes, deadline ${new Date(deadline * 1000).toISOString()}`);

                // Fetch current likes from Neynar
                const likes = await getCastLikes(castUrl);
                console.log(`[Oracle] Market #${id}: ${likes}/${threshold} likes`);

                let shouldResolve = false;
                let outcome: number = Outcome.UNRESOLVED;
                let outcomeStr = '';

                // Condition A: BASED (hit threshold) - can resolve anytime
                if (likes >= threshold) {
                    outcome = Outcome.MOON;
                    outcomeStr = 'BASED';
                    shouldResolve = true;
                    console.log(`[Oracle] Market #${id}: BASED! 🟢 (${likes} >= ${threshold})`);
                }
                // Condition B: ERASED (deadline passed without hitting threshold)
                else if (now > deadline) {
                    outcome = Outcome.DOOM;
                    outcomeStr = 'ERASED';
                    shouldResolve = true;
                    console.log(`[Oracle] Market #${id}: ERASED! 🔻 (${likes} < ${threshold}, deadline passed)`);
                }
                // Still pending
                else {
                    pendingCount++;
                    results.push({
                        marketId: id,
                        status: 'pending',
                        likes,
                        threshold,
                    });
                    console.log(`[Oracle] Market #${id}: Still pending (${likes}/${threshold}, ${Math.round((deadline - now) / 60)}min remaining)`);
                    continue;
                }

                // Resolve the market on-chain
                if (shouldResolve) {
                    const txHash = await resolveMarket(id, outcome);

                    if (txHash) {
                        resolvedCount++;
                        results.push({
                            marketId: id,
                            status: 'resolved',
                            outcome: outcomeStr,
                            likes,
                            threshold,
                            txHash,
                        });
                    } else {
                        errorCount++;
                        results.push({
                            marketId: id,
                            status: 'error',
                            error: 'Transaction failed',
                            likes,
                            threshold,
                        });
                    }
                }

            } catch (marketErr: any) {
                console.error(`[Oracle] Error processing market #${id}:`, marketErr.message);
                errorCount++;
                results.push({
                    marketId: id,
                    status: 'error',
                    error: marketErr.message,
                });
            }

            // Small delay between markets to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const duration = Date.now() - startTime;
        console.log(`[Oracle] === Completed in ${duration}ms ===`);
        console.log(`[Oracle] Resolved: ${resolvedCount}, Pending: ${pendingCount}, Errors: ${errorCount}`);

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
        console.error('[Oracle] Fatal error:', error);

        return createResponse({
            success: false,
            error: error.message || 'Unknown error',
            results,
        });
    }
}

// POST handler for manual triggers
export async function POST(req: NextRequest) {
    return GET(req);
}
