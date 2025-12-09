"use client";

export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { WagmiProvider, useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '@/lib/wagmi';
import { sdk } from '@farcaster/miniapp-sdk';
import { formatUSDC, parseUSDC, getMoonOdds, getDoomOdds } from '@/lib/contract';
import contractABI from '@/lib/contractABI.json';
import { erc20Abi, maxUint256 } from 'viem';

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
        const interval = setInterval(update, 60000); // Update every minute
        return () => clearInterval(interval);
    }, [deadline]);

    return <span className="text-zinc-500 font-mono text-[10px]">{timeLeft}</span>;
}

// --- components ---

function MarketCard({
    market,
    usdcBalance,
    allowance,
    refreshFinancials
}: {
    market: MarketIndex,
    usdcBalance?: bigint,
    allowance?: bigint,
    refreshFinancials: () => void
}) {
    const { isConnected, address } = useAccount();
    const [expanded, setExpanded] = useState(false);
    const [betAmount, setBetAmount] = useState('5');
    const [error, setError] = useState<string | null>(null);
    const { writeContractAsync, data: hash } = useWriteContract();
    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

    const [odds, setOdds] = useState<{ moon: number, doom: number }>({ moon: 50, doom: 50 });

    useEffect(() => {
        if (expanded) {
            Promise.all([
                getMoonOdds(market.market_id).catch(() => 50),
                getDoomOdds(market.market_id).catch(() => 50)
            ]).then(([moon, doom]) => setOdds({ moon, doom }));
        }
    }, [expanded, market.market_id]);

    useEffect(() => {
        if (isConfirmed) {
            refreshFinancials();
            setExpanded(false);
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

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 transition-all hover:border-purple-500/30">
            {/* Header: User + View Cast */}
            <div className="flex items-center justify-between mb-3">
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
                    href={market.cast_hash || '#'}
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

            {/* Metadata Bar (Progress & Timer) */}
            <div className="flex items-center justify-between bg-zinc-950/50 rounded-lg p-2 mb-3 border border-zinc-800/50">
                <div className="flex flex-col gap-1 flex-1 mr-4">
                    <div className="flex justify-between text-[10px] text-zinc-400">
                        <span>{market.likes_count || 0} Likes</span>
                        <span>Goal: {market.threshold}</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, Math.max(0, ((market.likes_count || 0) / Number(market.threshold || 1)) * 100))}%` }}
                        />
                    </div>
                </div>
                <div className="flex flex-col items-end">
                    <span className={`text-[10px] font-bold ${market.status === 'active' ? 'text-green-400' : 'text-zinc-500'}`}>
                        {market.status?.toUpperCase()}
                    </span>
                    <Countdown deadline={market.deadline} />
                </div>
            </div>

            {/* Inline Betting / Expand Toggle */}
            {expanded ? (
                <div className="mt-3 bg-zinc-950 rounded-xl p-3 border border-zinc-800 animate-in fade-in slide-in-from-top-2">
                    {/* Amount Input */}
                    <div className="relative mb-3">
                        <span className="absolute left-3 top-2.5 text-zinc-500 text-xs font-bold">$</span>
                        <input
                            type="number"
                            value={betAmount}
                            onChange={(e) => setBetAmount(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2 pl-6 pr-12 text-white font-bold text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                        <div className="absolute right-1 top-1 flex items-center gap-1">
                            <span className="text-xs text-zinc-500 font-bold mr-1">USDC</span>
                            <button onClick={() => setBetAmount(usdcBalance ? formatUSDC(usdcBalance) : '0')} className="bg-zinc-800 text-[10px] px-1.5 py-0.5 rounded text-zinc-300">MAX</button>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-2 mb-2">
                        <button
                            onClick={() => handleBet(true)}
                            disabled={isConfirming}
                            className="relative overflow-hidden p-2 rounded-lg bg-green-900/20 border border-green-500/30 hover:border-green-500/60 transition-all text-left group"
                        >
                            <div className="text-[10px] font-bold text-green-500 mb-0.5">BASED 🟢</div>
                            <div className="text-white font-black">{Math.round(odds.moon)}%</div>
                        </button>
                        <button
                            onClick={() => handleBet(false)}
                            disabled={isConfirming}
                            className="relative overflow-hidden p-2 rounded-lg bg-red-900/20 border border-red-500/30 hover:border-red-500/60 transition-all text-left group"
                        >
                            <div className="text-[10px] font-bold text-red-500 mb-0.5">ERASED 🔻</div>
                            <div className="text-white font-black">{Math.round(odds.doom)}%</div>
                        </button>
                    </div>

                    {/* Status / Error */}
                    {error && <div className="text-xs text-red-400 text-center mb-2">{error}</div>}
                    {isConfirming && <div className="text-xs text-purple-400 text-center animate-pulse mb-2">Processing transaction...</div>}

                    <button
                        onClick={() => setExpanded(false)}
                        className="w-full py-1.5 text-xs text-zinc-500 hover:text-zinc-300 font-medium"
                    >
                        Cancel
                    </button>
                </div>
            ) : (
                market.status === 'active' ? (
                    <button
                        onClick={() => setExpanded(true)}
                        disabled={!isConnected}
                        className="w-full py-2.5 bg-white text-black font-bold rounded-xl hover:scale-[1.02] active:scale-95 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isConnected ? 'Bet Now' : 'Connect Wallet to Bet'}
                    </button>
                ) : (
                    <div className="w-full py-2.5 bg-zinc-800 text-zinc-500 font-bold rounded-xl text-center text-sm cursor-not-allowed">
                        Market Closed
                    </div>
                )
            )}
        </div>
    );
}

type Tab = 'markets' | 'mybets' | 'faq' | 'guide';
type MarketFilter = 'all' | 'active' | 'resolved';

function MarketHubContent() {
    const { address, isConnected } = useAccount();
    const [activeTab, setActiveTab] = useState<Tab>('markets');
    const [markets, setMarkets] = useState<MarketIndex[]>([]);
    const [filter, setFilter] = useState<MarketFilter>('all');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

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

    // Removed the manual Supabase check block since we can just handle error gracefully in fetch

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
                .neq('author_username', 'shugito')
                .order('created_at', { ascending: false });

            if (search) query = query.ilike('author_username', `%${search}%`);

            if (filter === 'active') query = query.eq('status', 'active');
            else if (filter === 'resolved') query = query.neq('status', 'active');

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
                    <div className="w-full bg-zinc-900 text-zinc-500 text-[10px] text-center py-1 font-mono border-b border-zinc-800 mb-4">
                        Build: v2.2.3 - Reconnected Build
                    </div>
                    <div className="mb-4 flex justify-center">
                        <img src="/based-or-erased-banner.png" alt="Based or Erased" className="h-20 object-contain" />
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-2 px-4 no-scrollbar">
                        <TabButton active={activeTab === 'markets'} onClick={() => setActiveTab('markets')} icon="🎲">Markets</TabButton>
                        <TabButton active={activeTab === 'mybets'} onClick={() => setActiveTab('mybets')} icon="💰">My Bets</TabButton>
                        <TabButton active={activeTab === 'faq'} onClick={() => setActiveTab('faq')} icon="❓">FAQ</TabButton>
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
                            <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-lg border ${filter === 'all' ? 'bg-purple-900/30 border-purple-500 text-purple-300' : 'border-zinc-800 text-zinc-500'}`}>All</button>
                            <button onClick={() => setFilter('active')} className={`px-3 py-1.5 rounded-lg border ${filter === 'active' ? 'bg-green-900/30 border-green-500 text-green-300' : 'border-zinc-800 text-zinc-500'}`}>Active</button>
                            <button onClick={() => setFilter('resolved')} className={`px-3 py-1.5 rounded-lg border ${filter === 'resolved' ? 'bg-zinc-800 border-zinc-600 text-zinc-300' : 'border-zinc-800 text-zinc-500'}`}>Resolved</button>
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
                                    />
                                ))}
                                {markets.length === 0 && <div className="text-center text-zinc-500 py-10">No markets found.</div>}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'mybets' && <MyBetsSection markets={markets} address={address} isConnected={isConnected} onRefresh={fetchMarkets} />}
                {activeTab === 'faq' && <FAQSection />}
                {activeTab === 'guide' && <GuideSection />}
            </div>
        </div>
    );
}

// Sub-components
function TabButton({ active, onClick, icon, children }: { active: boolean, onClick: () => void, icon: string, children: React.ReactNode }) {
    return (
        <button onClick={onClick} className={`px-4 py-2 rounded-xl font-semibold text-sm whitespace-nowrap flex items-center gap-2 transition-all ${active ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-400'}`}>
            <span>{icon}</span>{children}
        </button>
    );
}

// My Bets Section
function MyBetsSection({ markets, address, isConnected, onRefresh }: {
    markets: MarketIndex[];
    address: string | undefined;
    isConnected: boolean;
    onRefresh: () => void;
}) {
    // 1. Prepare contracts for Multicall
    // Only check markets that are in the list (optimization)
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
                <p className="text-zinc-400 mb-6">Connect to view your betting history and claimable winnings.</p>
                <div className="text-sm text-zinc-500">
                    Open any market to connect your wallet
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

    // 2. Filter markets where user has a bet amount > 0
    const activeBets = markets.map((market, index) => {
        const betData = userBets?.[index]?.result as any;
        if (!betData) return null;
        if (betData.moonAmount > 0n || betData.doomAmount > 0n) {
            return { market, bet: betData };
        }
        return null; // No bet
    }).filter(item => item !== null);

    if (activeBets.length === 0) {
        return (
            <div className="text-center py-10">
                <div className="text-4xl mb-3">🎯</div>
                <h2 className="text-lg font-bold mb-2">No Active Bets</h2>
                <p className="text-zinc-500 text-sm">You haven't placed any bets yet.</p>
                <div className="mt-4 text-xs font-mono text-zinc-600 bg-black/50 p-2 rounded inline-block">{address}</div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-bold mb-4 flex justify-between items-center">
                <span>Your Bets ({activeBets.length})</span>
                <button onClick={() => { onRefresh(); refetch(); }} className="text-sm text-zinc-500 hover:text-white">🔄 Refresh</button>
            </h2>

            {activeBets.map((item: any) => (
                <div key={item.market.market_id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                            <img src={item.market.author_pfp_url} className="w-6 h-6 rounded-full" />
                            <span className="font-bold text-sm">@{item.market.author_username}</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${item.market.status === 'active' ? 'bg-green-900 text-green-400' : 'bg-zinc-700 text-zinc-400'}`}>
                            {item.market.status.toUpperCase()}
                        </span>
                    </div>

                    <Link href={`/miniapp?marketId=${item.market.market_id}`} className="block mb-4 hover:opacity-80 transition-opacity">
                        <p className="text-zinc-300 text-sm line-clamp-2">{item.market.cast_text}</p>
                    </Link>

                    <div className="grid grid-cols-2 gap-3">
                        {item.bet.moonAmount > 0n && (
                            <div className="bg-green-900/10 border border-green-500/20 rounded-lg p-2 flex justify-between items-center">
                                <span className="text-xs font-bold text-green-500">BASED</span>
                                <span className="font-mono text-sm font-bold">{formatUSDC(item.bet.moonAmount)} $</span>
                            </div>
                        )}
                        {item.bet.doomAmount > 0n && (
                            <div className="bg-red-900/10 border border-red-500/20 rounded-lg p-2 flex justify-between items-center">
                                <span className="text-xs font-bold text-red-500">ERASED</span>
                                <span className="font-mono text-sm font-bold">{formatUSDC(item.bet.doomAmount)} $</span>
                            </div>
                        )}
                    </div>

                    {item.bet.claimed && <div className="mt-2 text-center text-xs text-green-400 font-bold bg-green-900/20 py-1 rounded">✅ Paid Out</div>}
                </div>
            ))}
        </div>
    );
}

function FAQSection() {
    const faqs = [
        { q: "What is Based or Erased?", a: "Prediction market for Farcaster casts going viral." },
        { q: "What happens if I win?", a: "You share the losing pool's pot!" },
        { q: "Fees?", a: "1% protocol fee." }
    ];
    return (
        <div className="space-y-3">
            {faqs.map((f, i) => (
                <details key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 open:bg-zinc-800">
                    <summary className="font-bold text-sm cursor-pointer list-none flex justify-between">
                        {f.q} <span className="text-zinc-500">▼</span>
                    </summary>
                    <p className="mt-2 text-zinc-400 text-sm">{f.a}</p>
                </details>
            ))}
        </div>
    );
}

function GuideSection() {
    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h3 className="font-bold mb-4">How to Play</h3>
            <ul className="space-y-4 text-sm text-zinc-300">
                <li className="flex gap-3"><span className="text-xl">🔍</span> Find a cast you think will go viral (or flop).</li>
                <li className="flex gap-3"><span className="text-xl">🟢</span> Bet <b>BASED</b> if you think it will hit the target.</li>
                <li className="flex gap-3"><span className="text-xl">🔻</span> Bet <b>ERASED</b> if you think it will miss.</li>
                <li className="flex gap-3"><span className="text-xl">🏆</span> Winners split the pot!</li>
            </ul>
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
