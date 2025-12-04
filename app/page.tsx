import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Moon or Doom - Bet on Viral Moments',
  description: 'Prediction markets for Farcaster. Will it moon or doom?',
  openGraph: {
    title: 'Moon or Doom - Bet on Viral Moments',
    description: 'Will it moon? Or will it doom? Place your bets.',
  },
  other: {
    'fc:frame': 'vNext',
    'fc:frame:image': `${process.env.NEXT_PUBLIC_APP_URL}/api/og`,
    'fc:frame:button:1': 'Create Market',
    'fc:frame:button:1:action': 'post',
    'fc:frame:post_url': `${process.env.NEXT_PUBLIC_APP_URL}/api/frame`,
  },
};

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white font-[family-name:var(--font-body)]">
      {/* Header */}
      <div className="border-b border-zinc-800/50 backdrop-blur-sm sticky top-0 z-50 bg-black/80">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="text-2xl">🌙</div>
              <div className="text-xs absolute -bottom-1 -right-1">💥</div>
            </div>
            <span className="text-2xl font-bold font-[family-name:var(--font-heading)] tracking-tight">
              Moon or Doom
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-zinc-500 font-[family-name:var(--font-body)]">
            <span className="hidden md:inline">Base</span>
            <span className="hidden md:inline">•</span>
            <span>Farcaster</span>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="max-w-7xl mx-auto px-6 py-16 md:py-24">
        <div className="max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/5 border border-emerald-500/20 rounded-full text-emerald-400 text-sm mb-8 font-[family-name:var(--font-mono)] uppercase tracking-wider">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Live
          </div>

          <h1 className="text-6xl md:text-8xl font-bold mb-8 tracking-tighter font-[family-name:var(--font-heading)] leading-[0.9]">
            Will it <span className="text-emerald-400">MOON</span>
            <br />
            or <span className="text-red-500">DOOM</span>?
          </h1>

          <p className="text-xl md:text-2xl text-zinc-400 mb-16 max-w-2xl font-[family-name:var(--font-body)]">
            Bet on Farcaster engagement. Trade virality. Win when you're right.
          </p>

          {/* Example Markets */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 hover:border-emerald-500/30 hover:bg-zinc-900 transition-all group">
              <div className="text-zinc-500 text-xs mb-3 font-[family-name:var(--font-mono)] uppercase tracking-wider">Market 001</div>
              <div className="font-semibold mb-4 font-[family-name:var(--font-heading)]">100 likes in 24h?</div>
              <div className="flex gap-3">
                <div className="flex-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-center group-hover:bg-emerald-500/20 transition-colors">
                  <div className="text-emerald-400 text-xs font-[family-name:var(--font-mono)] mb-1">MOON</div>
                  <div className="text-2xl font-bold font-[family-name:var(--font-mono)]">65<span className="text-sm">%</span></div>
                </div>
                <div className="flex-1 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center group-hover:bg-red-500/20 transition-colors">
                  <div className="text-red-400 text-xs font-[family-name:var(--font-mono)] mb-1">DOOM</div>
                  <div className="text-2xl font-bold font-[family-name:var(--font-mono)]">35<span className="text-sm">%</span></div>
                </div>
              </div>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 hover:border-emerald-500/30 hover:bg-zinc-900 transition-all group">
              <div className="text-zinc-500 text-xs mb-3 font-[family-name:var(--font-mono)] uppercase tracking-wider">Market 002</div>
              <div className="font-semibold mb-4 font-[family-name:var(--font-heading)]">@vitalik replies?</div>
              <div className="flex gap-3">
                <div className="flex-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-center group-hover:bg-emerald-500/20 transition-colors">
                  <div className="text-emerald-400 text-xs font-[family-name:var(--font-mono)] mb-1">MOON</div>
                  <div className="text-2xl font-bold font-[family-name:var(--font-mono)]">12<span className="text-sm">%</span></div>
                </div>
                <div className="flex-1 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center group-hover:bg-red-500/20 transition-colors">
                  <div className="text-red-400 text-xs font-[family-name:var(--font-mono)] mb-1">DOOM</div>
                  <div className="text-2xl font-bold font-[family-name:var(--font-mono)]">88<span className="text-sm">%</span></div>
                </div>
              </div>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 hover:border-emerald-500/30 hover:bg-zinc-900 transition-all group">
              <div className="text-zinc-500 text-xs mb-3 font-[family-name:var(--font-mono)] uppercase tracking-wider">Market 003</div>
              <div className="font-semibold mb-4 font-[family-name:var(--font-heading)]">Goes viral?</div>
              <div className="flex gap-3">
                <div className="flex-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-center group-hover:bg-emerald-500/20 transition-colors">
                  <div className="text-emerald-400 text-xs font-[family-name:var(--font-mono)] mb-1">MOON</div>
                  <div className="text-2xl font-bold font-[family-name:var(--font-mono)]">42<span className="text-sm">%</span></div>
                </div>
                <div className="flex-1 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center group-hover:bg-red-500/20 transition-colors">
                  <div className="text-red-400 text-xs font-[family-name:var(--font-mono)] mb-1">DOOM</div>
                  <div className="text-2xl font-bold font-[family-name:var(--font-mono)]">58<span className="text-sm">%</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* How It Works */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
            <h2 className="text-2xl font-bold mb-6">How It Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center justify-center mb-3 text-emerald-500 font-bold">
                  1
                </div>
                <div className="font-semibold mb-2">Create Market</div>
                <div className="text-sm text-zinc-400">
                  Set up a prediction on any Farcaster cast
                </div>
              </div>
              <div>
                <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center justify-center mb-3 text-emerald-500 font-bold">
                  2
                </div>
                <div className="font-semibold mb-2">Place Bets</div>
                <div className="text-sm text-zinc-400">
                  Users bet YES or NO with USDC
                </div>
              </div>
              <div>
                <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center justify-center mb-3 text-emerald-500 font-bold">
                  3
                </div>
                <div className="font-semibold mb-2">Auto-Resolve</div>
                <div className="text-sm text-zinc-400">
                  Markets resolve based on real engagement
                </div>
              </div>
              <div>
                <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center justify-center mb-3 text-emerald-500 font-bold">
                  4
                </div>
                <div className="font-semibold mb-2">Win Rewards</div>
                <div className="text-sm text-zinc-400">
                  Winners split the pot (1% protocol fee)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
