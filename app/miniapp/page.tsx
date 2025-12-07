"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import Image from 'next/image';

// Safely initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// We export a function or use a singleton that checks initialization
const supabase = (supabaseUrl && supabaseAnonKey)
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

type MarketIndex = {
    market_id: number;
    cast_hash: string;
    author_username: string;
    author_pfp_url: string;
    cast_text: string;
    status: string;
    deadline: string;
};

export default function MarketExplorer() {
    const [markets, setMarkets] = useState<MarketIndex[]>([]);
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

    useEffect(() => {
        fetchMarkets();
    }, [search]);

    async function fetchMarkets() {
        setLoading(true);
        let query = supabase
            .from('market_index')
            .select('*')
            .order('created_at', { ascending: false });

        if (search) {
            query = query.ilike('author_username', `%${search}%`);
        }

        const { data, error } = await query;
        if (error) console.error('Error fetching markets:', error);
        if (data) setMarkets(data);
        setLoading(false);
    }

    return (
        <div className="min-h-screen bg-black text-white p-4 pb-20 font-sans">
            {/* Search Header */}
            <div className="mb-6 sticky top-0 bg-black/80 backdrop-blur-md z-10 py-2 border-b border-white/10">
                <h1 className="text-xl font-bold mb-4 bg-gradient-to-r from-green-400 to-purple-500 bg-clip-text text-transparent">
                    Live Markets
                </h1>
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search by author (e.g. vitalik)"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-mono text-sm"
                    />
                    <span className="absolute left-3 top-3.5 text-zinc-500">🔍</span>
                </div>
            </div>

            {/* Create FAB */}
            <Link
                href="/miniapp/create"
                className="fixed bottom-6 right-6 w-14 h-14 bg-white text-black rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all z-50 font-bold text-2xl"
            >
                +
            </Link>

            {/* Market Grid */}
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

                                <div className="flex items-center justify-between text-xs text-zinc-500">
                                    <span className={market.status === 'active' ? 'text-green-400' : 'text-zinc-500'}>
                                        ● {market.status?.toUpperCase() || 'ACTIVE'}
                                    </span>
                                    <span>Opensea ↗</span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
