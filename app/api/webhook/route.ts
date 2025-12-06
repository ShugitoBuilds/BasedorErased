import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient, createPublicClient, http, parseEventLogs } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import contractABI from '@/lib/contractABI.json';
import crypto from 'crypto';

// --- CONFIG ---
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const NEYNAR_SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID;
const NEYNAR_WEBHOOK_SECRET = process.env.NEYNAR_WEBHOOK_SECRET; // For HMAC validation
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://cast-predict.vercel.app';

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
 * Validate Neynar Webhook Signature (HMAC-SHA512)
 */
function validateWebhookSignature(body: string, signature: string | null): boolean {
    if (!NEYNAR_WEBHOOK_SECRET || !signature) {
        console.warn('Webhook signature validation skipped (no secret or signature)');
        return true; // Skip validation in dev if no secret configured
    }

    try {
        const hmac = crypto.createHmac('sha512', NEYNAR_WEBHOOK_SECRET);
        hmac.update(body);
        const expectedSignature = hmac.digest('hex');
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );
    } catch (err) {
        console.error('HMAC validation error:', err);
        return false;
    }
}

/**
 * Check if a market already exists for a given cast URL/hash
 */
async function findExistingMarket(castIdentifier: string): Promise<number | null> {
    try {
        const nextMarketId = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: contractABI,
            functionName: 'nextMarketId',
        }) as bigint;

        const count = Number(nextMarketId);

        // Iterate through all markets to find matching cast
        for (let id = 1; id < count; id++) {
            const market = await publicClient.readContract({
                address: CONTRACT_ADDRESS,
                abi: contractABI,
                functionName: 'getMarket',
                args: [BigInt(id)],
            }) as any;

            // Check if castUrl contains the identifier (hash or full URL)
            if (market.castUrl && (
                market.castUrl.includes(castIdentifier) ||
                castIdentifier.includes(market.castUrl)
            )) {
                return id;
            }
        }
        return null;
    } catch (err) {
        console.error('Error checking existing markets:', err);
        return null;
    }
}

/**
 * Parse command from cast text
 * Pattern: @basedorerased [threshold] [duration]
 * Examples:
 *   "@basedorerased" -> 100 likes, 24h
 *   "@basedorerased 50" -> 50 likes, 24h
 *   "@basedorerased 200 likes 12h" -> 200 likes, 12h
 */
function parseCommand(text: string): { threshold: number; durationHours: number } | null {
    // Check for mention pattern (case-insensitive)
    const mentionPattern = /@basedorerased/i;
    if (!mentionPattern.test(text)) {
        return null;
    }

    // Default values
    let threshold = 100;
    let durationHours = 24;

    // Parse threshold: look for number followed by optional "likes"
    const thresholdMatch = text.match(/(\d+)\s*(?:likes?)?/i);
    if (thresholdMatch) {
        const parsed = parseInt(thresholdMatch[1]);
        if (parsed > 0 && parsed <= 100000) {
            threshold = parsed;
        }
    }

    // Parse duration: look for "Xh" or "X hours"
    const durationMatch = text.match(/(\d+)\s*(?:h(?:ours?)?)/i);
    if (durationMatch) {
        const parsed = parseInt(durationMatch[1]);
        if (parsed >= 1 && parsed <= 168) { // 1 hour to 7 days
            durationHours = parsed;
        }
    }

    return { threshold, durationHours };
}

/**
 * Reply to a cast via Neynar
 */
async function replyToCast(parentHash: string, text: string): Promise<boolean> {
    if (!NEYNAR_API_KEY || !NEYNAR_SIGNER_UUID) {
        console.log('Skipping reply (missing NEYNAR_API_KEY or NEYNAR_SIGNER_UUID)');
        return false;
    }

    try {
        const response = await fetch('https://api.neynar.com/v2/farcaster/cast', {
            method: 'POST',
            headers: {
                'api_key': NEYNAR_API_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                signer_uuid: NEYNAR_SIGNER_UUID,
                text: text,
                parent: parentHash,
            }),
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('Neynar reply error:', errorData);
            return false;
        }

        console.log('Successfully replied to cast');
        return true;
    } catch (err) {
        console.error('Error posting reply:', err);
        return false;
    }
}

export async function POST(req: NextRequest) {
    // Always return 200 to prevent webhook retries (even on errors)
    const successResponse = () => NextResponse.json({ success: true }, { status: 200 });

    try {
        // Get raw body for signature validation
        const rawBody = await req.text();
        const signature = req.headers.get('X-Neynar-Signature');

        // 1. Validate Webhook Signature
        if (!validateWebhookSignature(rawBody, signature)) {
            console.error('Invalid webhook signature');
            return successResponse(); // Return 200 anyway to prevent retries
        }

        // Parse body
        const body = JSON.parse(rawBody);

        // 2. Validate webhook structure
        if (!body || !body.data) {
            console.error('Invalid webhook payload structure');
            return successResponse();
        }

        // 3. Extract Cast Data
        // Neynar webhook payload for cast.created events
        const cast = body.data;
        const castHash = cast.hash;
        const castText = cast.text || '';
        const authorFid = cast.author?.fid;
        const authorUsername = cast.author?.username || 'anon';

        // Build cast URL (Warpcast format)
        const castUrl = `https://warpcast.com/${authorUsername}/${castHash.slice(0, 10)}`;

        console.log(`[Webhook] Cast ${castHash} from @${authorUsername} (FID ${authorFid})`);
        console.log(`[Webhook] Text: "${castText}"`);

        // 4. Parse Command
        const command = parseCommand(castText);
        if (!command) {
            console.log('[Webhook] No valid command found, ignoring');
            return successResponse();
        }

        const { threshold, durationHours } = command;
        console.log(`[Webhook] Command parsed: ${threshold} likes in ${durationHours}h`);

        // 5. Check if market already exists for this cast
        const existingMarketId = await findExistingMarket(castHash);
        if (existingMarketId) {
            console.log(`[Webhook] Market #${existingMarketId} already exists for this cast`);

            await replyToCast(
                castHash,
                `Market already exists! 🎯\n\nMarket #${existingMarketId} is already tracking this cast.\n\nBet now: ${APP_URL}/miniapp?marketId=${existingMarketId}`
            );

            return successResponse();
        }

        // 6. Create Market on Blockchain
        console.log(`[Webhook] Creating market: ${threshold} likes, ${durationHours}h deadline`);

        const deadline = BigInt(Math.floor(Date.now() / 1000) + (durationHours * 3600));

        const txHash = await walletClient.writeContract({
            address: CONTRACT_ADDRESS,
            abi: contractABI,
            functionName: 'createMarket',
            args: [castUrl, BigInt(threshold), deadline],
        });

        console.log(`[Webhook] Transaction sent: ${txHash}`);

        // 7. Wait for receipt and extract Market ID from logs
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

        let newMarketId: number | null = null;

        // Parse MarketCreated event to get the market ID
        try {
            const logs = parseEventLogs({
                abi: contractABI,
                logs: receipt.logs,
                eventName: 'MarketCreated',
            });

            if (logs.length > 0) {
                newMarketId = Number((logs[0] as any).args.marketId);
            }
        } catch (parseErr) {
            console.error('Error parsing logs:', parseErr);
            // Fallback: read nextMarketId and subtract 1
            const nextId = await publicClient.readContract({
                address: CONTRACT_ADDRESS,
                abi: contractABI,
                functionName: 'nextMarketId',
            }) as bigint;
            newMarketId = Number(nextId) - 1;
        }

        console.log(`[Webhook] Market created: #${newMarketId}`);

        // 8. Reply to Cast with Mini App Link
        const replyText = `Market Created! 🔮\n\n` +
            `⚡ Based or Erased?\n` +
            `🎯 Goal: ${threshold} likes in ${durationHours}h\n` +
            `💰 Bet 1 USDC on the outcome\n\n` +
            `Bet now: ${APP_URL}/miniapp?marketId=${newMarketId}`;

        await replyToCast(castHash, replyText);

        return NextResponse.json({
            success: true,
            marketId: newMarketId,
            txHash,
        });

    } catch (error: any) {
        console.error('[Webhook] Error:', error);
        // Always return 200 to prevent webhook retry spam
        return NextResponse.json({
            success: false,
            error: error.message || 'Unknown error',
        }, { status: 200 });
    }
}

// Health check endpoint
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        service: 'Based or Erased Webhook',
        timestamp: new Date().toISOString(),
    });
}
