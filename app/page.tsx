import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CastPredict - Bet on Viral Moments',
  description: 'Prediction markets for Farcaster engagement',
  openGraph: {
    title: 'CastPredict - Bet on Viral Moments',
    description: 'Will this cast hit 100 likes? Place your bet.',
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
    <main className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center font-bold">
              C
            </div>
            <span className="text-xl font-bold">CastPredict</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-zinc-400">
            <span>Built on Base</span>
            <span>•</span>
            <span>Farcaster Frames v2</span>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="max-w-7xl mx-auto px-6 py-24">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Live Markets
          </div>

          <h1 className="text-7xl font-bold mb-6 tracking-tight">
            Bet on <span className="text-emerald-500">Viral</span> Moments
          </h1>

          <p className="text-2xl text-zinc-400 mb-12">
            Prediction markets for Farcaster engagement. Turn every cast into a trading opportunity.
          </p>

          {/* Example Markets */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-colors">
              <div className="text-zinc-500 text-sm mb-2">Example Market</div>
              <div className="font-semibold mb-4">Will this cast hit 100 likes?</div>
              <div className="flex gap-2">
                <div className="flex-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-center">
                  <div className="text-emerald-400 text-xs font-medium mb-1">YES</div>
                  <div className="text-xl font-bold">65%</div>
                </div>
                <div className="flex-1 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center">
                  <div className="text-red-400 text-xs font-medium mb-1">NO</div>
                  <div className="text-xl font-bold">35%</div>
                </div>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-colors">
              <div className="text-zinc-500 text-sm mb-2">Example Market</div>
              <div className="font-semibold mb-4">Will @vitalik reply?</div>
              <div className="flex gap-2">
                <div className="flex-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-center">
                  <div className="text-emerald-400 text-xs font-medium mb-1">YES</div>
                  <div className="text-xl font-bold">12%</div>
                </div>
                <div className="flex-1 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center">
                  <div className="text-red-400 text-xs font-medium mb-1">NO</div>
                  <div className="text-xl font-bold">88%</div>
                </div>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-colors">
              <div className="text-zinc-500 text-sm mb-2">Example Market</div>
              <div className="font-semibold mb-4">Viral in 24 hours?</div>
              <div className="flex gap-2">
                <div className="flex-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-center">
                  <div className="text-emerald-400 text-xs font-medium mb-1">YES</div>
                  <div className="text-xl font-bold">42%</div>
                </div>
                <div className="flex-1 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center">
                  <div className="text-red-400 text-xs font-medium mb-1">NO</div>
                  <div className="text-xl font-bold">58%</div>
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
