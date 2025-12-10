
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createPublicClient, http, parseAbiItem, decodeEventLog } from 'viem';
import { baseSepolia } from 'viem/chains';

// Init Supabase with Service Role Key to bypass RLS for inserts
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    SUPABASE_SERVICE_KEY
);

// Init Viem Client
const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
});

const MARKET_CREATED_EVENT = parseAbiItem(
    'event MarketCreated(uint256 indexed marketId, string castUrl, uint256 threshold, uint256 deadline, address creator)'
);

export async function POST(req: NextRequest) {
    try {
        const { txHash } = await req.json();

        if (!txHash) {
            return NextResponse.json({ error: 'Missing txHash' }, { status: 400 });
        }

        console.log(`[Sync] Verifying tx: ${txHash}`);

        // washers verify the transaction on-chain (Sanity Check)
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });

        if (receipt.status !== 'success') {
            return NextResponse.json({ error: 'Transaction failed on-chain' }, { status: 400 });
        }

        // Find the MarketCreated log
        let marketData = null;

        for (const log of receipt.logs) {
            try {
                // Attempt to decode log as MarketCreated
                const decoded = decodeEventLog({
                    abi: [MARKET_CREATED_EVENT],
                    data: log.data,
                    topics: log.topics,
                });

                if (decoded.eventName === 'MarketCreated') {
                    marketData = decoded.args;
                    break;
                }
            } catch (e) {
                // Not our event, skip
                continue;
            }
        }

        if (!marketData) {
            console.error('[Sync] Event not found in logs. Receipt logs:', receipt.logs.length);
            return NextResponse.json({ error: 'No MarketCreated event found in logs' }, { status: 400 });
        }

        console.log(`[Sync] Found Market Data:`, marketData);

        const { marketId, castUrl, deadline, threshold } = marketData;

        // 1. Fetch Cast Info from Neynar
        let authorUsername = 'unknown';
        let authorPfp = '';
        let castText = 'Content unavailable';
        let likesCount = 0;

        if (process.env.NEYNAR_API_KEY) {
            try {
                // Simple extraction or use full URL if Neynar supports it
                // Neynar "cast" endpoint supports 'url' type
                const neynarRes = await fetch(
                    `https://api.neynar.com/v2/farcaster/cast?identifier=${encodeURIComponent(castUrl)}&type=url`,
                    { headers: { 'api_key': process.env.NEYNAR_API_KEY, 'accept': 'application/json' } }
                );

                if (neynarRes.ok) {
                    const data = await neynarRes.json();
                    const cast = data.cast;
                    if (cast) {
                        authorUsername = cast.author.username;
                        authorPfp = cast.author.pfp_url;
                        castText = cast.text;
                        likesCount = cast.reactions?.likes_count || 0;
                    }
                } else {
                    console.warn('[Sync] Neynar Fetch Failed:', await neynarRes.text());
                }
            } catch (err) {
                console.error('[Sync] Neynar Error:', err);
            }
        }

        // MAPPING: marketId -> market_id, castUrl -> cast_hash (schema uses cast_hash), deadline -> deadline

        const { error } = await supabase
            .from('market_index')
            .upsert({
                market_id: Number(marketId),
                cast_hash: castUrl,
                deadline: new Date(Number(deadline) * 1000).toISOString(),
                status: 'active',
                created_at: new Date().toISOString(),
                author_username: authorUsername,
                author_pfp_url: authorPfp,
                cast_text: castText,
                likes_count: likesCount,
                threshold: threshold.toString()
            }, { onConflict: 'market_id' });

        if (error) {
            console.error('[Sync] DB Error:', error);
            // Check for RLS policy violation
            if (error.code === '42501') {
                return NextResponse.json({ error: 'Permission denied (RLS). Check Service Key.' }, { status: 500 });
            }
            return NextResponse.json({ error: 'Database insertion failed' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            marketId: Number(marketId),
            message: 'Market synced successfully'
        });

    } catch (error) {
        console.error('[Sync] Critical Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
