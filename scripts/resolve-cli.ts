import * as dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { createWalletClient, http, publicActions } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import contractABI from '../lib/contractABI.json';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// CONFIG
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY!;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
const ADMIN_PRIVATE_KEY = (process.env.ADMIN_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY) as `0x${string}`;

const OUTCOME_BASED = 1;
const OUTCOME_ERASED = 2;

async function run() {
    console.log('--- STARTING RESOLUTION CLI ---');
    if (!ADMIN_PRIVATE_KEY) throw new Error('Missing Admin Key');

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // 1. Fetch Expired
    const nowIso = new Date().toISOString();
    const { data: markets, error } = await supabase
        .from('market_index')
        .select('*')
        .eq('status', 'active')
        .lt('deadline', nowIso);

    if (error) console.error(error);
    if (!markets || markets.length === 0) {
        console.log('No expired markets found.');
        return;
    }

    console.log(`Found ${markets.length} expired markets.`);

    // 2. Setup Wallet
    const account = privateKeyToAccount(ADMIN_PRIVATE_KEY);
    const walletClient = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http()
    }).extend(publicActions);

    console.log(`Wallet: ${account.address}`);

    // 3. Loop
    for (const market of markets) {
        console.log(`Resolving Market #${market.market_id}...`);

        try {
            // Fetch Neynar
            const res = await fetch(`https://api.neynar.com/v2/farcaster/cast?type=hash&identifier=${market.cast_hash}`, {
                headers: { 'api_key': NEYNAR_API_KEY }
            });

            if (!res.ok) {
                console.error(`Neynar Error: ${res.status}`);
                continue;
            }

            const data = await res.json();
            const likesCount = data.cast.reactions.likes_count;
            const threshold = parseInt(market.threshold || '0');
            const outcome = likesCount >= threshold ? OUTCOME_BASED : OUTCOME_ERASED;

            console.log(`  Likes: ${likesCount} / Threshold: ${threshold} -> Status: ${outcome === 1 ? 'BASED' : 'ERASED'}`);

            // On-Chain
            const txHash = await walletClient.writeContract({
                address: CONTRACT_ADDRESS,
                abi: contractABI,
                functionName: 'resolveMarket',
                args: [BigInt(market.market_id), outcome]
            });

            console.log(`  Tx Sent: ${txHash}`);
            const receipt = await walletClient.waitForTransactionReceipt({ hash: txHash });

            if (receipt.status === 'success') {
                console.log('  Tx Confirmed.');
                // Update DB
                await supabase
                    .from('market_index')
                    .update({ status: 'resolved', likes_count: likesCount })
                    .eq('market_id', market.market_id);
                console.log('  DB Updated.');
            } else {
                console.error('  Tx Reverted!');
            }

        } catch (err: any) {
            console.error(`  Error: ${err.message}`);
        }
    }
}

run();
