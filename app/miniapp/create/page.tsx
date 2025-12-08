"use client";

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseAbi } from 'viem';
import { useRouter } from 'next/navigation';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '@/lib/wagmi';

const queryClient = new QueryClient();

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;

const abi = parseAbi([
    'function createMarket(string calldata castUrl, uint256 threshold, uint256 deadline) external returns (uint256)'
]);

function CreateMarketContent() {
    const router = useRouter();
    const { isConnected } = useAccount();
    const { writeContract, data: hash, isPending } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

    const [threshold, setThreshold] = useState(100);
    const [castUrl, setCastUrl] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncSuccess, setSyncSuccess] = useState(false);

    useEffect(() => {
        if (isSuccess && hash && !isSyncing && !syncSuccess) {
            setIsSyncing(true);
            console.log('Triggering Sync for:', hash);

            fetch('/api/sync/market', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ txHash: hash })
            })
                .then(async (res) => {
                    const data = await res.json();
                    if (res.ok && data.success) {
                        console.log('Sync Success:', data);
                        setSyncSuccess(true);
                    } else {
                        console.error('Sync Failed:', data);
                        alert('Market created on-chain but failed to sync to DB. Please refresh in a moment.');
                    }
                })
                .catch(err => {
                    console.error('Sync Error:', err);
                })
                .finally(() => {
                    setIsSyncing(false);
                });
        }
    }, [isSuccess, hash, isSyncing, syncSuccess]);


    async function handleCreate() {
        if (!castUrl) return alert('Enter a Cast URL');

        // 24h from now
        const deadline = Math.floor(Date.now() / 1000) + (24 * 60 * 60);

        writeContract({
            address: CONTRACT_ADDRESS,
            abi,
            functionName: 'createMarket',
            args: [castUrl, BigInt(threshold), BigInt(deadline)],
        });
    }

    return (
        <div className="min-h-screen bg-black text-white p-6 flex flex-col font-sans">
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => router.back()}
                    className="p-2 -ml-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                </button>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                    Create Market
                </h1>
            </div>

            <div className="flex flex-col gap-6">
                {/* Cast URL Input */}
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-zinc-400">Cast URL</label>
                    <input
                        type="text"
                        placeholder="https://warpcast.com/..."
                        value={castUrl}
                        onChange={(e) => setCastUrl(e.target.value)}
                        className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                </div>

                {/* Threshold Slider */}
                <div className="flex flex-col gap-4 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
                    <div className="flex justify-between items-center">
                        <label className="text-sm font-bold text-zinc-400">Target Likes</label>
                        <span className="text-2xl font-bold text-green-400">{threshold}</span>
                    </div>
                    <input
                        type="range"
                        min="10"
                        max="10000"
                        step="10"
                        value={threshold}
                        onChange={(e) => setThreshold(Number(e.target.value))}
                        className="w-full accent-green-500 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                    />
                    <p className="text-xs text-zinc-500 text-center">
                        Will the cast hit {threshold} likes in 24h?
                    </p>
                </div>

                {/* Action Button */}
                <button
                    onClick={handleCreate}
                    disabled={!isConnected || isPending || isConfirming}
                    className="w-full py-4 mt-4 bg-white text-black rounded-xl font-black text-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isPending ? 'Check Wallet...' : isConfirming ? 'Creating...' : '🚀 Launch Market'}
                </button>

                {isSuccess && (
                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-center">
                        <div className="text-green-400 font-bold mb-2">
                            {syncSuccess ? 'Market Created & Synced!' : isSyncing ? 'Syncing to Database...' : 'Market Created!'}
                        </div>
                        {isSyncing && <div className="text-xs text-zinc-500 mb-2 animate-pulse"> finalizing... </div>}
                        <button
                            onClick={() => router.push('/miniapp')}
                            disabled={isSyncing}
                            className="text-sm underline text-zinc-400 hover:text-white disabled:opacity-50"
                        >
                            Back to Explorer
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function CreateMarketPage() {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <CreateMarketContent />
            </QueryClientProvider>
        </WagmiProvider>
    );
}
