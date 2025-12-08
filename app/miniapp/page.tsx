"use client";

export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { WagmiProvider, useAccount } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '@/lib/wagmi';
import { sdk } from '@farcaster/miniapp-sdk';

// Safely initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = (supabaseUrl && supabaseAnonKey)
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

const queryClient = new QueryClient();

type MarketIndex = {
    market_id: number;
    cast_hash: string;
    author_username: string;
    author_pfp_url: string;
    cast_text: string;
    status: string;
    deadline: string;
    created_at: string;
};

type Tab = 'markets' | 'mybets' | 'faq' | 'guide';
type MarketFilter = 'all' | 'active' | 'resolved';

function MarketHubContent() {
    const { address, isConnected } = useAccount();
    const [activeTab, setActiveTab] = useState<Tab>('markets');
    const [markets, setMarkets] = useState<MarketIndex[]>([]);
    const [filter, setFilter] = useState<MarketFilter>('all');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    if (!supabase) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 text-center">
                <div>
                    <h1 className="text-red-500 text-2xl font-bold mb-2">Configuration Error</h1>
                    <p className="text-zinc-400">Missing <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code></p>
                    <p className="text-sm text-zinc-600 mt-4">Please add this to your Vercel Environment Variables.</p>
                </div>
            </div>
        );
    }

    // Initialize Farcaster SDK
    useEffect(() => {
        async function initSDK() {
            try {
                await sdk.actions.ready();
            } catch (err) {
                console.error('Failed to initialize Farcaster SDK:', err);
            }
        }
        initSDK();
    }, []);

    useEffect(() => {
        if (activeTab === 'markets') {
            fetchMarkets();
        } else {
            setLoading(false);
        }
    }, [activeTab, search, filter]);

    async function fetchMarkets() {
        if (!supabase) {
            setLoading(false);
            return;
        }
        setLoading(true);

        try {
            let query = supabase
                .from('market_index')
                .select('*')
                .neq('author_username', 'shugito') // Hide test markets
                .order('created_at', { ascending: false });

            if (search) {
                query = query.ilike('author_username', `%${search}%`);
            }

            if (filter === 'active') {
                query = query.eq('status', 'active');
            } else if (filter === 'resolved') {
                query = query.neq('status', 'active');
            }

            const { data, error } = await query;
            if (error) {
                console.error('Error fetching markets:', error);
            }
            if (data) {
                setMarkets(data);
            }
        } catch (err) {
            console.error('Unexpected error fetching markets:', err);
        } finally {
            setLoading(false);
        }
    }
    return (
        <div className="min-h-screen bg-black text-white font-sans">
            {/* Header with Tabs */}
            <div className="sticky top-0 bg-black/95 backdrop-blur-md z-20 border-b border-white/10">
                <div className="p-4">
                    <div className="mb-4 flex justify-center">
                        <img
                            src="/based-or-erased-banner.png"
                            alt="Based or Erased"
                            className="h-48 w-auto object-contain"
                        />
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        <TabButton
                            active={activeTab === 'markets'}
                            onClick={() => setActiveTab('markets')}
                            icon="🎲"
                        >
                            Markets
                        </TabButton>
                        <TabButton
                            active={activeTab === 'mybets'}
                            onClick={() => setActiveTab('mybets')}
                            icon="💰"
                        >
                            My Bets
                        </TabButton>
                        <TabButton
                            active={activeTab === 'faq'}
                            onClick={() => setActiveTab('faq')}
                            icon="❓"
                        >
                            FAQ
                        </TabButton>
                        <TabButton
                            active={activeTab === 'guide'}
                            onClick={() => setActiveTab('guide')}
                            icon="📚"
                        >
                            Guide
                        </TabButton>
                    </div >
                </div >
            </div >

            {/* Create FAB */}
            < Link
                href="/miniapp/create"
                className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-green-400 to-purple-500 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all z-50 font-bold text-2xl"
            >
                +
            </Link >

            {/* Tab Content */}
            < div className="p-4 pb-24" >
                {activeTab === 'markets' && (
                    <MarketsSection
                        markets={markets}
                        loading={loading}
                        search={search}
                        setSearch={setSearch}
                        filter={filter}
                        setFilter={setFilter}
                        onRefresh={fetchMarkets}
                    />
                )}

                {
                    activeTab === 'mybets' && (
                        <MyBetsSection address={address} isConnected={isConnected} />
                    )
                }

                {activeTab === 'faq' && <FAQSection />}

                {activeTab === 'guide' && <GuideSection />}
            </div >
        </div >
    );
}

// Tab Button Component
function TabButton({ active, onClick, icon, children }: {
    active: boolean;
    onClick: () => void;
    icon: string;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={`
                px-4 py-2 rounded-xl font-semibold text-sm whitespace-nowrap transition-all flex items-center gap-2
                ${active
                    ? 'bg-gradient-to-r from-green-400 to-purple-500 text-black'
                    : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                }
            `}
        >
            <span>{icon}</span>
            {children}
        </button>
    );
}

// Markets Section
function MarketsSection({
    markets,
    loading,
    search,
    setSearch,
    filter,
    setFilter,
    onRefresh
}: {
    markets: MarketIndex[];
    loading: boolean;
    search: string;
    setSearch: (s: string) => void;
    filter: MarketFilter;
    setFilter: (f: MarketFilter) => void;
    onRefresh: () => void;
}) {
    return (
        <div>
            {/* Search & Filter */}
            <div className="mb-4 space-y-3">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            placeholder="Search by author..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-mono text-sm"
                        />
                        <span className="absolute left-3 top-3.5 text-zinc-500">🔍</span>
                    </div>
                    <button
                        onClick={onRefresh}
                        disabled={loading}
                        className="px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white hover:bg-zinc-800 active:scale-95 transition-all disabled:opacity-50"
                        title="Refresh markets"
                    >
                        🔄
                    </button>
                </div>

                <div className="flex gap-2">
                    <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>
                        All
                    </FilterButton>
                    <FilterButton active={filter === 'active'} onClick={() => setFilter('active')}>
                        Active
                    </FilterButton>
                    <FilterButton active={filter === 'resolved'} onClick={() => setFilter('resolved')}>
                        Resolved
                    </FilterButton>
                </div>
            </div>

            {/* Market List */}
            {loading ? (
                <div className="flex flex-col gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-32 bg-zinc-900/50 rounded-2xl animate-pulse" />
                    ))}
                </div>
            ) : markets.length === 0 ? (
                <div className="text-center py-20 text-zinc-500">
                    <div className="text-4xl mb-2">🔭</div>
                    <p>No markets found.</p>
                    {search && <p className="text-sm mt-2">Try a different search term.</p>}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {markets.map((market) => (
                        <Link
                            key={market.market_id}
                            href={`/miniapp/market/${market.market_id}`}
                            className="block group"
                        >
                            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 transition-all group-hover:border-purple-500/50 group-hover:bg-zinc-800/50">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        {market.author_pfp_url ? (
                                            <img
                                                src={market.author_pfp_url}
                                                alt={market.author_username}
                                                className="w-6 h-6 rounded-full"
                                            />
                                        ) : (
                                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500" />
                                        )}
                                        <span className="text-sm font-bold text-zinc-300">@{market.author_username}</span>
                                    </div>
                                    <span className="text-[10px] font-mono text-zinc-500">#{market.market_id}</span>
                                </div>

                                <p className="text-zinc-100 font-medium mb-3 line-clamp-2">
                                    {market.cast_text || "Will this cast go viral?"}
                                </p>

                                <div className="flex items-center justify-between text-xs">
                                    <span className={market.status === 'active' ? 'text-green-400 font-semibold' : 'text-zinc-500'}>
                                        ● {market.status?.toUpperCase() || 'ACTIVE'}
                                    </span>
                                    <span className="text-purple-400">Bet Now →</span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className={`
                px-4 py-2 rounded-lg text-sm font-semibold transition-all
                ${active ? 'bg-purple-500 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}
            `}
        >
            {children}
        </button>
    );
}

// My Bets Section
function MyBetsSection({ address, isConnected }: { address: string | undefined; isConnected: boolean }) {
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

    return (
        <div>
            <h2 className="text-lg font-bold mb-4">Your Bets</h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
                <div className="text-4xl mb-3">🎯</div>
                <p className="text-zinc-400 mb-2">No bets yet!</p>
                <p className="text-sm text-zinc-500">Browse markets and place your first bet to see it here.</p>
            </div>

            <div className="mt-6 p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
                <div className="text-xs text-zinc-500 mb-2">Connected Wallet</div>
                <div className="font-mono text-sm text-purple-400 break-all">{address}</div>
            </div>
        </div>
    );
}

// FAQ Section
function FAQSection() {
    const faqs = [
        {
            q: "What is Based or Erased?",
            a: "Based or Erased is a prediction market where you bet USDC on whether a Farcaster cast will go viral (reach a like threshold) within a set time period."
        },
        {
            q: "What are Power Badge Likes?",
            a: "Power Badge Likes are likes from verified Farcaster users with Power Badges. This prevents bot manipulation - markets resolve based on authentic engagement, not fake likes."
        },
        {
            q: "How do payouts work?",
            a: "Winners split the losing side's pool proportionally to their bet size, minus a 1% protocol fee. If you bet 10 USDC and your side wins, you get your 10 USDC back plus your share of the losing pool."
        },
        {
            q: "What happens if a cast is deleted?",
            a: "If a cast is deleted before resolution, the market automatically resolves as ERASED (DOOM). We snapshot cast data on creation to prevent griefing."
        },
        {
            q: "What's the betting limit?",
            a: "You can bet between 1 and 500 USDC per market to ensure fair liquidity distribution."
        },
        {
            q: "What are the fees?",
            a: "There's a 1% protocol fee on the total pool, taken when markets are resolved."
        },
        {
            q: "Which blockchain?",
            a: "We're on Base Sepolia testnet. Use testnet USDC (get from faucet) to try it out!"
        }
    ];

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-bold mb-4">Frequently Asked Questions</h2>
            {faqs.map((faq, i) => (
                <details key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden group">
                    <summary className="p-4 cursor-pointer font-semibold text-purple-400 hover:bg-zinc-800 transition-colors flex justify-between items-center">
                        {faq.q}
                        <span className="text-zinc-500 group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="p-4 pt-0 text-zinc-300 text-sm leading-relaxed">
                        {faq.a}
                    </div>
                </details>
            ))}
        </div>
    );
}

// Guide Section
function GuideSection() {
    const steps = [
        {
            title: "1. Browse Markets",
            desc: "Explore active prediction markets on viral Farcaster casts.",
            icon: "🔍"
        },
        {
            title: "2. Make Your Prediction",
            desc: "Choose BASED (🌕 Moon) if you think it'll go viral, or ERASED (💀 Doom) if it won't.",
            icon: "🎯"
        },
        {
            title: "3. Connect & Bet",
            desc: "Connect your wallet, approve USDC, and place your bet (1-500 USDC).",
            icon: "💰"
        },
        {
            title: "4. Wait for Resolution",
            desc: "Markets resolve when the deadline hits. Did it reach the Power Like threshold?",
            icon: "⏰"
        },
        {
            title: "5. Claim Winnings",
            desc: "If you win, claim your share of the pool! Winners split the losing side's bets.",
            icon: "🏆"
        }
    ];

    return (
        <div>
            <h2 className="text-lg font-bold mb-6">How It Works</h2>

            <div className="space-y-4 mb-8">
                {steps.map((step, i) => (
                    <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                        <div className="flex items-start gap-4">
                            <div className="text-3xl">{step.icon}</div>
                            <div>
                                <h3 className="font-bold text-white mb-1">{step.title}</h3>
                                <p className="text-sm text-zinc-400">{step.desc}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Contract Info */}
            <div className="bg-gradient-to-r from-purple-900/20 to-green-900/20 border border-purple-500/30 rounded-2xl p-5">
                <h3 className="font-bold mb-3 text-purple-400">Smart Contract</h3>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-zinc-400">Network:</span>
                        <span className="text-white font-mono">Base Sepolia</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-zinc-400">Token:</span>
                        <span className="text-white font-mono">USDC (Testnet)</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-zinc-400">Contract:</span>
                        <a
                            href={`https://sepolia.basescan.org/address/${process.env.NEXT_PUBLIC_CONTRACT_ADDRESS}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-400 font-mono text-xs break-all hover:text-purple-300 transition-colors"
                        >
                            {process.env.NEXT_PUBLIC_CONTRACT_ADDRESS} ↗
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function MarketHub() {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <div style={{ display: 'contents' }}>
                    <React.Suspense fallback={
                        <div className="min-h-screen bg-black text-white flex items-center justify-center">
                            <div className="animate-pulse text-zinc-500">Loading Hub...</div>
                        </div>
                    }>
                        <MarketHubContent />
                    </React.Suspense>
                </div>
            </QueryClientProvider>
        </WagmiProvider>
    );
}
