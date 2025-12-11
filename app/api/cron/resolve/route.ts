import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createWalletClient, http, publicActions } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import contractABI from '@/lib/contractABI.json';

// --- CONFIG ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!; // Service role key preferred for admin actions, but anon might suffice if RLS allows or we use server logic
// Note: For actual admin writes to 'market_index' that might be protected, consider using SUPABASE_SERVICE_ROLE_KEY if available. 
// For now, using what we have. If RLS blocks updates, user might need to add SERVICE_KEY.

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY!;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
const ADMIN_PRIVATE_KEY = (process.env.ADMIN_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY) as `0x${string}`; // Checked: User has DEPLOYER_PRIVATE_KEY
const CRON_SECRET = process.env.CRON_SECRET;

// Helper to determine outcome
const OUTCOME_BASED = 1; // MOON
const OUTCOME_ERASED = 2; // DOOM

export async function GET(req: NextRequest) {
    // 1. Security Check
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
        // Allow local testing if no secret set, or strictly enforce? 
        // For now, strict if secret exists.
        if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    if (!ADMIN_PRIVATE_KEY) {
        return NextResponse.json({ error: 'Missing ADMIN_PRIVATE_KEY' }, { status: 500 });
    }

    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

        // 2. Fetch Expired & Active Markets
        // "Active" markets where "Deadline" has passed.
        const nowIso = new Date().toISOString();
        const { data: expiredMarkets, error: dbError } = await supabase
            .from('market_index')
            .select('*')
            .eq('status', 'active')
            .lt('deadline', nowIso);

        if (dbError) throw new Error(`DB Error: ${dbError.message}`);
        if (!expiredMarkets || expiredMarkets.length === 0) {
            return NextResponse.json({ message: 'No markets to resolve' });
        }

        console.log(`Found ${expiredMarkets.length} markets to resolve.`);
        const results = [];

        // 3. Setup Wallet
        const account = privateKeyToAccount(ADMIN_PRIVATE_KEY);
        const walletClient = createWalletClient({
            account,
            chain: baseSepolia,
            transport: http()
        }).extend(publicActions);

        // 4. Loop & Resolve
        for (const market of expiredMarkets) {
            try {
                // A. Fetch Neynar Data
                // Optimize: Use cast_hash or url? API takes hash or url.
                // Cast hash is 'cast_hash' in DB.
                const castHash = market.cast_hash;
                if (!castHash) {
                    console.error(`Market ${market.market_id} missing cast_hash`);
                    continue;
                }

                const neynarRes = await fetch(`https://api.neynar.com/v2/farcaster/cast?type=hash&identifier=${castHash}`, {
                    headers: { 'api_key': NEYNAR_API_KEY }
                });

                if (!neynarRes.ok) {
                    throw new Error(`Neynar API error: ${neynarRes.status}`);
                }

                const neynarData = await neynarRes.json();
                const cast = neynarData.cast;

                // Get Likes
                const likesCount = cast.reactions.likes_count;
                const threshold = parseInt(market.threshold || '0');

                // Determine Outcome
                // Logic: If likes >= threshold -> BASED (Winner). Else ERASED.
                const outcome = likesCount >= threshold ? OUTCOME_BASED : OUTCOME_ERASED;

                console.log(`Resolving Market ${market.market_id}: Likes ${likesCount} vs Threshold ${threshold} -> Outcome ${outcome === 1 ? 'BASED' : 'ERASED'}`);

                // B. Execute On-Chain
                // Check if already resolved on chain? (Optional optimization, but contract handles it)
                const txHash = await walletClient.writeContract({
                    address: CONTRACT_ADDRESS,
                    abi: contractABI,
                    functionName: 'resolveMarket',
                    args: [BigInt(market.market_id), outcome]
                });

                console.log(`Tx Sent: ${txHash}`);

                // Wait for receipt? Or trust cron will retry if DB update fails? 
                // Better to wait to ensure consistency.
                const receipt = await walletClient.waitForTransactionReceipt({ hash: txHash });

                if (receipt.status === 'success') {
                    // C. Update DB
                    const { error: updateError } = await supabase
                        .from('market_index')
                        .update({
                            status: 'resolved',
                            likes_count: likesCount // Save final count
                        })
                        .eq('market_id', market.market_id);

                    if (updateError) console.error(`Failed to update DB for ${market.market_id}:`, updateError);

                    results.push({
                        id: market.market_id,
                        status: 'resolved',
                        outcome: outcome === 1 ? 'BASED' : 'ERASED',
                        tx: txHash
                    });
                } else {
                    throw new Error(`Tx reverted: ${txHash}`);
                }

            } catch (err: any) {
                console.error(`Failed to resolve market ${market.market_id}:`, err);
                results.push({ id: market.market_id, error: err.message });
            }
        }

        // 5. Prune Old Markets (> 30 Days Past Deadline)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const { error: pruneError, count } = await supabase
            .from('market_index')
            .delete({ count: 'exact' })
            .lt('deadline', thirtyDaysAgo.toISOString());

        if (pruneError) console.error('Pruning Failed:', pruneError);
        else if (count && count > 0) console.log(`Pruned ${count} old markets.`);

        return NextResponse.json({ success: true, results, pruned: count });

    } catch (error: any) {
        console.error('Cron job failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
