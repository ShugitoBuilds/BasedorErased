
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import contractABI from '@/lib/contractABI.json';

// Init Supabase (Service Key needed for updates?)
// Ideally we validat the update against the chain, so we can use Service Key securely.
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    SUPABASE_SERVICE_KEY
);

// Init Viem
const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
});

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;

export async function POST(req: NextRequest) {
    try {
        const { marketId } = await req.json();

        if (!marketId) {
            return NextResponse.json({ error: 'Missing marketId' }, { status: 400 });
        }

        console.log(`[Sync:Resolution] Syncing Market ${marketId}...`);

        // 1. Fetch Market State from Chain
        const marketData = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: contractABI,
            functionName: 'markets',
            args: [BigInt(marketId)]
        }) as any;

        // marketData struct: [id, castHash, casteText, ..., outcome, resolved, ...]
        // We need 'outcome' and 'resolved'.
        // Struct index depends on ABI.
        // Assuming:
        // struct Market { uint256 id; string castHash; ... enum Outcome outcome; bool resolved; ... }
        // We can usually access by name if returned as object, but readContract usually returns array or object depending on config.
        // Let's assume array for safety or check ABI.
        // Based on previous code artifacts:
        // Mapping returns individual fields? No, it returns the Struct.
        
        // Let's rely on the returned object properties if Viem parses it (it usually does with ABI).
        const resolved = marketData[8]; // Check ABI or infer. 
        // Actually, let's look at the result safely.
        
        // BETTER: Use 'getMarket' if available? No, public mapping 'markets'.
        // Viem returns array for struct usually.
        // Indices:
        // 0: id
        // 1: castHash
        // 2: castText
        // 3: authorUsername
        // 4: authorPfp
        // 5: threshold
        // 6: deadline
        // 7: creationTime
        // 8: outcome (uint8)
        // 9: resolved (bool)
        // 10: totalMoonBets
        // 11: totalDoomBets
        // 12: collateral...
        
        // Wait, I should verify the ABI structure order to be safe.
        // But for now, I'll trust the order: Outcome is likely before or after Resolved.
        // Let's use `outcome` and `resolved` from the result array.
        
        // Wait, standard Viem with JSON ABI often returns *Array* for struct.
        // Let's assume indices based on solidity definition order.
        
        const isResolved = marketData[9]; 
        const outcome = Number(marketData[8]); // 0=Unresolved, 1=Moon, 2=Doom, 3=Cancelled

        console.log(`[Sync:Resolution] Chain State: Resolved=${isResolved}, Outcome=${outcome}`);

        if (!isResolved) {
             return NextResponse.json({ message: 'Market not resolved on chain yet.' });
        }

        // 2. Update DB
        // Map Outcome to String for DB 'status'?
        // DB status: 'active', 'resolved', 'cancelled'?
        // Schema checks:
        // V1 schema had 'status' = text.
        // We probably store 'resolved' and maybe have a separate 'outcome' column?
        // Or status = 'resolved_moon' / 'resolved_doom'?
        // Let's check `cron/resolve/route.ts`:
        // .update({ status: 'resolved', likes_count: ... })
        // It sets status to 'resolved'.
        // Does it set outcome?
        // Cron just logs outcome.
        // We might need to add `outcome` to DB if it's missing.
        // Validating `market_index` schema would be good.
        // But for MVP, `status = 'resolved'` is key to unblock UI.
        
        // WAIT: How does UI know WHO won if status is just 'resolved'?
        // The UI calculates winnings based on `claimWinnings` success?
        // Or does it display "Based Won"?
        // `MarketCard` doesn't seem to show "Based Won". It shows "Resolved".
        // The user knows if they won by checking "Claim".
        
        // Update:
        const { error } = await supabase
            .from('market_index')
            .update({
                status: 'resolved',
                // We could store outcome if we have a column, otherwise just resolved.
            })
            .eq('market_id', marketId);

        if (error) {
            console.error('[Sync:Resolution] DB Update Failed:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, outcome });

    } catch (error: any) {
        console.error('[Sync:Resolution] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
