"use client";

// FORCE DYNAMIC
export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { WagmiProvider, useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useBalance } from 'wagmi';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { config } from '@/lib/wagmi';
import { sdk } from '@farcaster/miniapp-sdk';
import { formatUSDC, parseUSDC, getMoonOdds, getDoomOdds } from '@/lib/contract';
import contractABI from '@/lib/contractABI.json';
import { erc20Abi, maxUint256, formatEther } from 'viem';

// Safely initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = (supabaseUrl && supabaseAnonKey)
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

const queryClient = new QueryClient();

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://basedorerased.vercel.app';

// ADMIN WALLETS (Lowercase)
const ADMIN_WALLETS = [
    '0xAD355883F2044F7E666270685957d190135359ad',
    '0x26C1122D086A0c3c626B5706922F24599f692A20',
    '0xd42Fe6aE017daaa721f47cE25a3B66675C2F635d',
    '0x05eebf02305bf34c446c298105174e099c716bb9'
].map(s => s.toLowerCase());

type MarketIndex = {
    market_id: number;
    cast_hash: string;
    author_username: string;
    author_pfp_url: string;
    cast_text: string;
    status: string;
    deadline: string;
    created_at: string;
    likes_count?: number;
    threshold?: string;
};

function Countdown({ deadline }: { deadline: string }) {
    const [timeLeft, setTimeLeft] = useState<string>('Loading...');

    useEffect(() => {
        function update() {
            const diff = new Date(deadline).getTime() - Date.now();
            if (diff <= 0) {
                setTimeLeft('Ended');
                return;
            }
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            setTimeLeft(`${hours}h ${mins}m left`);
        }
        update();
        const interval = setInterval(update, 60000); // 1 min
        return () => clearInterval(interval);
    }, [deadline]);

    return <span className="text-zinc-500 font-mono text-[10px]">{timeLeft}</span>;
}

// MARKET CARD
function MarketCard({
    market,
    usdcBalance,
    allowance,
    refreshFinancials,
    isAdmin
}: {
    market: MarketIndex,
    usdcBalance?: bigint,
    allowance?: bigint,
    refreshFinancials: () => void,
    isAdmin: boolean
}) {
    const { isConnected, address } = useAccount();
    // const [expanded, setExpanded] = useState(false); // REMOVED
    const [betAmount, setBetAmount] = useState('5');
    const [error, setError] = useState<string | null>(null);
    const { writeContractAsync, data: hash } = useWriteContract();
    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

    const [odds, setOdds] = useState<{ moon: number, doom: number }>({ moon: 50, doom: 50 });

    useEffect(() => {
        // ALWAYS fetch odds now
        Promise.all([
            getMoonOdds(market.market_id).catch(() => 50),
            getDoomOdds(market.market_id).catch(() => 50)
        ]).then(([moon, doom]) => setOdds({ moon, doom }));
    }, [market.market_id]);

    useEffect(() => {
        if (isConfirmed) {
            refreshFinancials();
            // setExpanded(false); // No longer needed
        }
    }, [isConfirmed, refreshFinancials]);

    const handleBet = async (isMoon: boolean) => {
        setError(null);
        if (!isConnected || !address) {
            setError('Please connect wallet');
            return;
        }

        const amountNum = parseFloat(betAmount);
        if (isNaN(amountNum) || amountNum < 1 || amountNum > 500) {
            setError('Bet must be 1-500 USDC');
            return;
        }

        try {
            const amountWei = parseUSDC(betAmount);

            if (usdcBalance !== undefined && usdcBalance < amountWei) {
                setError('Insufficient USDC');
                return;
            }

            if (!allowance || allowance < amountWei) {
                await writeContractAsync({
                    address: USDC_ADDRESS,
                    abi: erc20Abi,
                    functionName: 'approve',
                    args: [CONTRACT_ADDRESS, maxUint256],
                });
                return;
            }

            await writeContractAsync({
                address: CONTRACT_ADDRESS,
                abi: contractABI,
                functionName: isMoon ? 'betMoon' : 'betDoom',
                args: [BigInt(market.market_id), amountWei],
            });

        } catch (err: any) {
            console.error(err);
            setError(err.message?.slice(0, 50) || 'Transaction failed');
        }
    };

    const [confirmState, setConfirmState] = useState<{ type: 'resolve' | 'delete', outcome?: number } | null>(null);

    const handleAdminCancel = async () => {
        try {
            const res = await fetch('/api/admin/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ marketId: market.market_id, address })
            });
            if (res.ok) {
                window.location.reload();
            } else {
                console.error('Failed to cancel');
            }
        } catch (e) { console.error(e); }
    };

    const executeResolve = async (outcome: number) => {
        try {
            await writeContractAsync({
                address: CONTRACT_ADDRESS,
                abi: contractABI,
                functionName: 'resolveMarket',
                args: [BigInt(market.market_id), outcome],
            });
            setConfirmState(null);
        } catch (err: any) {
            console.error(err);
            setError(`Resolution failed: ${err.message || 'Unknown error'}`);
        }
    };

    // --- LIVE SCORE FETCH DISABLED ---
    const displayLikes = market.likes_count ?? 0;

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 transition-all hover:border-purple-500/30 relative group">
            {/* ADMIN UI DISABLED (Commented out for now) */}
            
            {/* Header: User + View Cast */}
            <div className="flex items-center justify-between mb-3 mt-2">
                <div className="flex items-center gap-2">
                    {market.author_pfp_url ? (
                        <img src={market.author_pfp_url} alt={market.author_username} className="w-8 h-8 rounded-full border border-zinc-700" />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500" />
                    )}
                    <div>
                        <div className="text-sm font-bold text-white leading-tight">@{market.author_username}</div>
                        <div className="text-[10px] text-zinc-500">#{market.market_id}</div>
                    </div>
                </div>

                <a
                    href={market.cast_hash?.startsWith('http') ? market.cast_hash : `https://warpcast.com/${market.author_username}/${market.cast_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-[10px] font-medium text-zinc-300 transition-colors"
                >
                    View Cast ↗
                </a>
            </div>

            {/* Cast Text */}
            <p className="text-zinc-200 text-sm font-medium mb-3 line-clamp-3">
                {market.cast_text || "Loading cast details..."}
            </p>

            {/* Metadata Bar (Progress & Timer) - LIKES TRACKER DISABLED FOR MVP */}
            <div className="flex items-center justify-between bg-zinc-950/50 rounded-lg p-2 mb-3 border border-zinc-800/50 text-[10px] shadow-inner">
                <span className={`font-bold ${market.status === 'active' ? 'text-green-400' : 'text-zinc-500'}`}>
                    {market.status?.toUpperCase()}
                </span>
                <span className="font-bold text-zinc-300 text-center flex-1">
                    GOAL: <span className="text-white text-xs">{market.threshold} Likes</span>
                </span>
                <span className="font-mono text-[10px] text-zinc-400 bg-zinc-900/50 px-1.5 py-0.5 rounded border border-zinc-800">
                   <Countdown deadline={market.deadline} />
                </span>
            </div>


            {/* NEW BETTING UI (Always Visible if Active) */}
            {market.status === 'active' ? (
                <div className="mt-4 space-y-3">
                    
                    {/* 1. Amount Input */}
                    <div className="relative">
                        <span className="absolute left-3 top-2.5 text-zinc-500 text-xs font-bold">$</span>
                        <input
                            type="number"
                            value={betAmount}
                            onChange={(e) => setBetAmount(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg py-2 pl-6 pr-12 text-white font-bold text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 placeholder-zinc-700"
                            placeholder="Amount"
                        />
                        <div className="absolute right-1 top-1 flex items-center gap-1">
                            <span className="text-xs text-zinc-500 font-bold mr-1">USDC</span>
                            <button onClick={() => setBetAmount(usdcBalance ? formatUSDC(usdcBalance) : '0')} className="bg-zinc-800 hover:bg-zinc-700 text-[10px] px-1.5 py-0.5 rounded text-zinc-300 transition-colors">MAX</button>
                        </div>
                    </div>

                    {/* 2. Stacked Bar Chart */}
                    <div className="w-full h-6 bg-zinc-800 rounded-full overflow-hidden flex relative">
                        <div 
                            className="h-full bg-green-500 transition-all duration-500 flex items-center justify-start pl-2" 
                            style={{ width: `${odds.moon}%` }}
                        >
                            <span className="text-[10px] font-black text-black/70 mix-blend-multiply">{Math.round(odds.moon)}%</span>
                        </div>
                        <div 
                            className="h-full bg-red-500 transition-all duration-500 flex items-center justify-end pr-2" 
                            style={{ width: `${odds.doom}%` }}
                        >
                            <span className="text-[10px] font-black text-black/70 mix-blend-multiply">{Math.round(odds.doom)}%</span>
                        </div>
                    </div>

                    {/* 3. Betting Buttons */}
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => handleBet(true)}
                            disabled={isConfirming || !isConnected}
                            className="flex items-center justify-center py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold text-xs shadow-lg shadow-green-900/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            BASED 🟢
                        </button>
                        <button
                            onClick={() => handleBet(false)}
                            disabled={isConfirming || !isConnected}
                            className="flex items-center justify-center py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-900/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            ERASED 🔻
                        </button>
                    </div>

                    {/* Status / Error */}
                    {error && <div className="text-xs text-red-400 text-center font-medium bg-red-950/30 p-1 rounded">{error}</div>}
                    {isConfirming && <div className="text-xs text-purple-400 text-center animate-pulse font-medium">Confirming transaction...</div>}
                    {!isConnected && <div className="text-xs text-zinc-500 text-center">Connect wallet to place bets</div>}

                </div>
            ) : (
                <div className="w-full py-3 bg-zinc-800/50 border border-zinc-800 text-zinc-500 font-bold rounded-xl text-center text-sm cursor-not-allowed mt-2">
                    Market Closed
                </div>
            )}
        </div>
    );
}


// ... Main Logic ...

type Tab = 'markets' | 'mybets' | 'guide';
type MarketFilter = 'all' | 'active' | 'resolved';

function MarketHubContent() {
    const { address, isConnected } = useAccount();
    const [activeTab, setActiveTab] = useState<Tab>('markets');
    const [markets, setMarkets] = useState<MarketIndex[]>([]);
    const [filter, setFilter] = useState<MarketFilter>('active');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    const isAdmin = !!address && ADMIN_WALLETS.includes(address.toLowerCase());

    const { data: allowance, refetch: refetchAllowance } = useReadContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'allowance',
        args: address ? [address, CONTRACT_ADDRESS] : undefined,
        query: { enabled: !!address }
    });

    const { data: usdcBalance, refetch: refetchBalance } = useReadContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        query: { enabled: !!address }
    });

    const refreshFinancials = () => {
        refetchAllowance();
        refetchBalance();
    };

    // ... (SDK Init etc)

    useEffect(() => {
        async function initSDK() {
            try { await sdk.actions.ready(); } catch (err) { console.error(err); }
        }
        initSDK();
    }, []);

    useEffect(() => {
        if (activeTab === 'markets' || activeTab === 'mybets') {
            fetchMarkets();
        } else {
            setLoading(false);
        }
    }, [activeTab, search, filter]);

    async function fetchMarkets() {
        if (!supabase) { setFetchError("Supabase not configured"); setLoading(false); return; }
        setLoading(true);

        try {
            let query = supabase
                .from('market_index')
                .select('*')
                .order('created_at', { ascending: false });

            if (search) query = query.ilike('author_username', `%${search}%`);

            if (filter === 'active') query = query.eq('status', 'active');
            else if (filter === 'resolved') query = query.neq('status', 'active');

            // HIDE Cancelled markets unless SEARCHING or explicit toggle (not implemented). 
            // Just hide them from default view.
            if (filter !== 'all') {
                // already handled
            } else {
                query = query.neq('status', 'admin_cancelled');
            }

            const { data, error } = await query;
            if (error) {
                console.error('Error fetching markets:', error);
                setFetchError(error.message);
            } else if (data) {
                setMarkets(data);
                setFetchError(null);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-black text-white font-sans">
            <div className="sticky top-0 bg-black/95 backdrop-blur-md z-20 border-b border-white/10">
                <div className="p-0 pb-4">
                    <div className="w-full bg-zinc-900 border-b border-zinc-800 mb-4 flex justify-between items-center px-4 py-2">
                        <span className="text-[10px] text-zinc-500 font-mono">v2.5.0 {isAdmin && <span className="text-red-500 font-bold ml-1">ADMIN</span>}</span>
                        
                        {/* Wallet / Balance */}
                        {!isConnected ? (
                            <button onClick={() => { /* Auto handled */ }} className="bg-white text-black text-xs font-bold px-3 py-1.5 rounded-lg hover:scale-105 transition-transform">
                                Connect Wallet
                            </button>
                        ) : (
                            <div className="flex items-center gap-2 bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-700">
                                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                <span className="text-xs font-bold text-white">{usdcBalance ? formatUSDC(usdcBalance) : '0'} USDC</span>
                            </div>
                        )}
                    </div>
                    <div className="mb-4 flex justify-center">
                        <img src="/based-or-erased-banner.png" alt="Based or Erased" className="h-20 object-contain" />
                    </div>

                    <div className="grid grid-cols-3 gap-1 px-4 mb-2">
                        <TabButton active={activeTab === 'markets'} onClick={() => setActiveTab('markets')} icon="🎲">Markets</TabButton>
                        <TabButton active={activeTab === 'mybets'} onClick={() => setActiveTab('mybets')} icon="💰">My Bets</TabButton>
                        <TabButton active={activeTab === 'guide'} onClick={() => setActiveTab('guide')} icon="📚">Guide</TabButton>
                    </div>
                </div>
            </div>

            <Link href="/miniapp/create" className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-green-400 to-purple-500 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all z-50 font-bold text-2xl">
                +
            </Link>

            <div className="p-4 pb-24">
                {activeTab === 'markets' && (
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Search author..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-sm"
                            />
                            <button onClick={() => fetchMarkets()} className="bg-zinc-900 px-3 rounded-xl border border-zinc-800">🔄</button>
                        </div>

                        <div className="flex gap-2 text-xs">
                            <button onClick={() => setFilter('active')} className={`px-3 py-1.5 rounded-lg border ${filter === 'active' ? 'bg-green-900/30 border-green-500 text-green-300' : 'border-zinc-800 text-zinc-500'}`}>Active</button>
                            <button onClick={() => setFilter('resolved')} className={`px-3 py-1.5 rounded-lg border ${filter === 'resolved' ? 'bg-zinc-800 border-zinc-600 text-zinc-300' : 'border-zinc-800 text-zinc-500'}`}>Resolved</button>
                            <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-lg border ${filter === 'all' ? 'bg-purple-900/30 border-purple-500 text-purple-300' : 'border-zinc-800 text-zinc-500'}`}>All</button>
                        </div>

                        {loading ? (
                            <div className="animate-pulse space-y-4">
                                {[1, 2, 3].map(i => <div key={i} className="h-40 bg-zinc-900 rounded-2xl" />)}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {markets.map(m => (
                                    <MarketCard
                                        key={m.market_id}
                                        market={m}
                                        usdcBalance={usdcBalance}
                                        allowance={allowance}
                                        refreshFinancials={refreshFinancials}
                                        isAdmin={isAdmin}
                                    />
                                ))}
                                {markets.length === 0 && <div className="text-center text-zinc-500 py-10">No markets found.</div>}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'mybets' && <MyBetsSection markets={markets} address={address} isConnected={isConnected} onRefresh={fetchMarkets} />}
                {activeTab === 'guide' && <GuideSection />}
            </div>
        </div>
    );
}

// ... tab components ... 
function TabButton({ active, onClick, icon, children }: { active: boolean, onClick: () => void, icon: string, children: React.ReactNode }) {
    return (
        <button onClick={onClick} className={`px-2 py-2 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1 transition-all ${active ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-400'}`}>
            <span className="text-lg leading-none">{icon}</span>
            <span>{children}</span>
        </button>
    );
}

function ClaimButton({ marketId, onSuccess }: { marketId: number, onSuccess: () => void }) {
    const { writeContractAsync, data: hash } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

    useEffect(() => {
        if (isSuccess) onSuccess();
    }, [isSuccess]);

    const handleClaim = async () => {
        try {
            await writeContractAsync({
                address: CONTRACT_ADDRESS,
                abi: contractABI,
                functionName: 'claimWinnings',
                args: [BigInt(marketId)],
            });
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <button
            onClick={handleClaim}
            disabled={isConfirming}
            className="w-full mt-2 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold rounded-lg text-sm hover:scale-105 transition-all disabled:opacity-50"
        >
            {isConfirming ? 'Claiming...' : '🏆 Claim Winnings'}
        </button>
    );
}

function GuideSection() {
    const faqs = [
        {
            q: "What is Based or Erased?",
            a: "This is a prediction market for Farcaster content. You bet on whether a specific Cast will achieve a certain number of Likes within 24 hours."
        },
         {
            q: "⚠️ CRITICAL: What if the Cast is Deleted?",
            a: "If the author deletes the Cast before the deadline, the market is INVALIDATED (Cancelled). ALL bets are refunded 100% (minus gas fees). No platform fees are taken. This ensures fairness and prevents manipulation."
        },
        {
            q: "How do I win?",
            a: "If you bet 'BASED' and the cast hits the Like Threshold, you win. If you bet 'ERASED' and it fails to hit the target, you win."
        },
        {
            q: "How are payouts calculated?",
            a: "It's a shared pot system (Pari-mutuel). Visual example: If the BASED pool has $100 and the ERASED pool has $0, and BASED wins, you get your money back. If ERASED had $50, the total pot is $150. Based winners split that $150 proportional to their bet."
        },
        {
            q: "What are the fees?",
            a: "The protocol takes a small 1% fee from the winning pot to cover operational costs."
        },
        {
            q: "How do I claim my winnings?",
            a: "Go to the 'My Bets' tab. If you won, you'll see a 'Claim Winnings' button next to completed markets."
        }
    ];

    return (
        <div className="space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
                <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">How to Play</h3>

                <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-xl flex items-start gap-3">
                    <div className="text-xl">ℹ️</div>
                    <div>
                        <h4 className="font-bold text-blue-400 text-sm">USDC Only</h4>
                        <p className="text-xs text-blue-200 mt-1">
                            This platform exclusively uses <strong>USDC on Base</strong> for all bets and payouts. Please ensure your wallet has USDC to participate.
                        </p>
                    </div>
                </div>

                <div className="flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-lg font-bold shrink-0">1</div>
                    <div>
                        <h4 className="font-bold text-white mb-1">Find a Cast</h4>
                        <p className="text-sm text-zinc-400">Browse the 'Markets' tab to see active predictions. Look for casts you think are viral hits or flops.</p>
                    </div>
                </div>

                <div className="flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-full bg-green-900/30 text-green-500 flex items-center justify-center text-lg font-bold shrink-0">2</div>
                    <div>
                        <h4 className="font-bold text-white mb-1">Bet BASED (Green)</h4>
                        <p className="text-sm text-zinc-400">Bet this if you think the cast WILL hit the like target before the deadline.</p>
                    </div>
                </div>

                <div className="flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-full bg-red-900/30 text-red-500 flex items-center justify-center text-lg font-bold shrink-0">3</div>
                    <div>
                        <h4 className="font-bold text-white mb-1">Bet ERASED (Red)</h4>
                        <p className="text-sm text-zinc-400">Bet this if you think the cast will FAIL to hit the target.</p>
                    </div>
                </div>

                <div className="flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-lg font-bold shrink-0">4</div>
                    <div>
                        <h4 className="font-bold text-white mb-1">Claim Winnings</h4>
                        <p className="text-sm text-zinc-400">If you chose correctly, claim your share of the loser's pot from the 'My Bets' tab!</p>
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                <h3 className="text-lg font-bold px-2">Frequently Asked Questions</h3>
                {faqs.map((f, i) => (
                    <details key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 open:bg-zinc-800 transition-colors">
                        <summary className="font-bold text-sm cursor-pointer list-none flex justify-between items-center bg-transparent appearance-none">
                            {f.q} <span className="text-zinc-500 transform transition-transform open:rotate-180">▼</span>
                        </summary>
                        <p className="mt-3 text-zinc-400 text-sm leading-relaxed">{f.a}</p>
                    </details>
                ))}
            </div>
        </div>
    );
}

function MyBetsSection({ markets, address, isConnected, onRefresh }: {
    markets: MarketIndex[];
    address: string | undefined;
    isConnected: boolean;
    onRefresh: () => void;
}) {
    const [filter, setFilter] = useState<'active' | 'resolved' | 'all'>('active');

    // 1. Prepare contracts for Multicall
    // ... (rest of hook remains same) ...
    const { data: userBets, isLoading, refetch } = useReadContracts({
        contracts: markets.map(m => ({
            address: CONTRACT_ADDRESS,
            abi: contractABI as any,
            functionName: 'getUserBet',
            args: address ? [BigInt(m.market_id), address] : undefined
        })),
        query: { enabled: isConnected && !!address && markets.length > 0 }
    });

    if (!isConnected) {
        return (
            <div className="text-center py-20">
                <div className="text-6xl mb-4">👛</div>
                <h2 className="text-xl font-bold mb-2">Connect Your Wallet</h2>
                {/* Standard Connect Button via SDK/Wagmi usually handled implicitly or via dedicated button */}
                <p className="text-zinc-400 mb-6 font-medium">Connect to view your betting history.</p>
                <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-800 text-xs text-zinc-500">
                    Use the "Connect Wallet" button in the top bar.
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[1, 2].map(i => <div key={i} className="h-32 bg-zinc-900/50 rounded-2xl animate-pulse" />)}
            </div>
        );
    }

    // 2. Filter markets where user has a bet amount > 0 AND matches filter status
    const filteredBets = markets.map((market, index) => {
        const betData = userBets?.[index]?.result as any;
        if (!betData) return null;
        
        // Must have a bet
        if (betData.moonAmount === 0n && betData.doomAmount === 0n) return null;

        const isExpired = new Date(market.deadline).getTime() < Date.now();
        const isResolvedOrExpired = market.status !== 'active' || isExpired;

        // Apply Filter
        if (filter === 'active' && isResolvedOrExpired) return null;
        if (filter === 'resolved' && !isResolvedOrExpired) return null;
        
        return { market, bet: betData, isExpired };
    }).filter(item => item !== null);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold">Your Bets</h2>
                <div className="flex gap-2 text-xs">
                     <button onClick={() => setFilter('active')} className={`px-2 py-1 rounded border ${filter === 'active' ? 'bg-green-900/30 border-green-500 text-green-300' : 'border-zinc-800 text-zinc-500'}`}>Active</button>
                     <button onClick={() => setFilter('resolved')} className={`px-2 py-1 rounded border ${filter === 'resolved' ? 'bg-zinc-800 border-zinc-600 text-zinc-300' : 'border-zinc-800 text-zinc-500'}`}>History</button>
                     <button onClick={() => setFilter('all')} className={`px-2 py-1 rounded border ${filter === 'all' ? 'bg-purple-900/30 border-purple-500 text-purple-300' : 'border-zinc-800 text-zinc-500'}`}>All</button>
                </div>
            </div>
            
            {filteredBets.length === 0 ? (
                <div className="text-center py-10 bg-zinc-900/30 rounded-2xl border border-zinc-800/50">
                    <p className="text-zinc-500 text-sm">No bets found.</p>
                </div>
            ) : ( 
               <div className="text-right mb-2">
                   <button onClick={() => { onRefresh(); refetch(); }} className="text-xs text-zinc-500 hover:text-white flex items-center gap-1 ml-auto">
                       🔄 Refresh Data
                   </button>
               </div>
            )}

            {filteredBets.map((item: any) => (
                <div key={item.market.market_id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                            <img src={item.market.author_pfp_url} className="w-6 h-6 rounded-full" />
                            <span className="font-bold text-sm">@{item.market.author_username}</span>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${item.market.status === 'active' && !item.isExpired ? 'bg-green-900 text-green-400' : 'bg-zinc-700 text-zinc-400'}`}>
                                {item.market.status === 'active' && item.isExpired ? 'EXPIRED' : item.market.status.toUpperCase()}
                            </span>
                        </div>
                    </div>

                    <Link href={`/miniapp?marketId=${item.market.market_id}`} className="block mb-4 hover:opacity-80 transition-opacity">
                        <p className="text-zinc-300 text-sm line-clamp-2">{item.market.cast_text}</p>
                    </Link>

                    <div className="grid grid-cols-2 gap-3">
                        {item.bet.moonAmount > 0n && (
                            <div className="bg-green-900/10 border border-green-500/20 rounded-lg p-2 flex justify-between items-center">
                                <span className="text-xs font-bold text-green-500">BASED</span>
                                <span className="font-mono text-sm font-bold">{formatUSDC(item.bet.moonAmount)}</span>
                            </div>
                        )}
                        {item.bet.doomAmount > 0n && (
                            <div className="bg-red-900/10 border border-red-500/20 rounded-lg p-2 flex justify-between items-center">
                                <span className="text-xs font-bold text-red-500">ERASED</span>
                                <span className="font-mono text-sm font-bold">{formatUSDC(item.bet.doomAmount)}</span>
                            </div>
                        )}
                    </div>

                    {item.bet.claimed ? (
                        <div className="mt-2 text-center text-xs text-green-400 font-bold bg-green-900/20 py-1 rounded">✅ Paid Out</div>
                    ) : (
                        (item.market.status !== 'active' || item.isExpired) && 
                        <ClaimButton marketId={item.market.market_id} onSuccess={() => { onRefresh(); refetch(); }} />
                    )}
                </div>
            ))}
        </div>
    );
}

export default function MarketHub() {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <MarketHubContent />
            </QueryClientProvider>
        </WagmiProvider>
    );
}
