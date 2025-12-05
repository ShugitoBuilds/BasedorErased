import { Metadata } from 'next';

const miniappEmbed = JSON.stringify({
  version: '1',
  imageUrl: 'https://cast-predict.vercel.app/api/og',
  button: {
    title: 'Open Moon or Doom',
    action: {
      type: 'launch_miniapp',
      name: 'Moon or Doom',
      url: 'https://cast-predict.vercel.app/miniapp',
    },
  },
});

export const metadata: Metadata = {
  title: 'Moon or Doom - Bet on Viral Moments',
  description: 'Prediction markets for Farcaster. Will it moon or doom?',
  openGraph: {
    title: 'Moon or Doom - Bet on Viral Moments',
    description: 'Will it moon? Or will it doom? Place your bets.',
  },
  other: {
    'fc:miniapp': miniappEmbed,
    'fc:frame': miniappEmbed, // Backward compatibility
  },
};

export default function Home() {
  return (
    <main
      className="min-h-screen text-white font-[family-name:var(--font-body)]"
      style={{ background: 'radial-gradient(circle at center, #0a0a0a 0%, #000000 100%)' }}
    >
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
      <div className="max-w-7xl mx-auto px-6 py-24 md:py-32">
        <div className="max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 border rounded-full text-sm mb-10 font-[family-name:var(--font-mono)] uppercase tracking-wider" style={{ background: 'rgba(52, 211, 153, 0.05)', borderColor: 'rgba(52, 211, 153, 0.2)', color: '#34D399' }}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#34D399' }}></span>
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: '#34D399' }}></span>
            </span>
            Live
          </div>

          <h1 className="text-6xl md:text-8xl font-bold mb-10 tracking-tighter font-[family-name:var(--font-heading)] leading-[0.9]">
            Will it{' '}
            <span
              className="inline-block"
              style={{
                background: 'linear-gradient(135deg, #34D399 0%, #10B981 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 0 20px rgba(52, 211, 153, 0.4))',
              }}
            >
              MOON
            </span>
            <br />
            or{' '}
            <span
              className="inline-block"
              style={{
                background: 'linear-gradient(135deg, #FB7185 0%, #F43F5E 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 0 20px rgba(251, 113, 133, 0.4))',
              }}
            >
              DOOM
            </span>
            ?
          </h1>

          <p className="text-xl md:text-2xl text-zinc-400 mb-20 max-w-2xl font-[family-name:var(--font-body)]">
            Bet on Farcaster engagement. Trade virality. Win when you're right.
          </p>

          {/* Example Markets */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
            <div
              className="border rounded-xl p-6 transition-all duration-300 group hover:-translate-y-1 hover:border-[rgba(52,211,153,0.5)]"
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(10px)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
              }}
            >
              <div className="text-zinc-500 text-xs mb-3 font-[family-name:var(--font-mono)] uppercase tracking-wider">Market 001</div>
              <div className="font-semibold mb-4 font-[family-name:var(--font-heading)]">100 likes in 24h?</div>
              <div className="flex gap-3">
                <div
                  className="flex-1 border rounded-lg p-3 text-center transition-all"
                  style={{
                    background: 'rgba(52, 211, 153, 0.1)',
                    borderColor: 'rgba(52, 211, 153, 0.3)',
                  }}
                >
                  <div className="text-xs font-[family-name:var(--font-mono)] mb-1" style={{ color: '#34D399' }}>MOON</div>
                  <div className="text-2xl font-bold font-[family-name:var(--font-mono)]">65<span className="text-sm">%</span></div>
                </div>
                <div
                  className="flex-1 border rounded-lg p-3 text-center transition-all"
                  style={{
                    background: 'rgba(251, 113, 133, 0.1)',
                    borderColor: 'rgba(251, 113, 133, 0.3)',
                  }}
                >
                  <div className="text-xs font-[family-name:var(--font-mono)] mb-1" style={{ color: '#FB7185' }}>DOOM</div>
                  <div className="text-2xl font-bold font-[family-name:var(--font-mono)]">35<span className="text-sm">%</span></div>
                </div>
              </div>
            </div>

            <div
              className="border rounded-xl p-6 transition-all duration-300 group hover:-translate-y-1 hover:border-[rgba(52,211,153,0.5)]"
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(10px)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
              }}
            >
              <div className="text-zinc-500 text-xs mb-3 font-[family-name:var(--font-mono)] uppercase tracking-wider">Market 002</div>
              <div className="font-semibold mb-4 font-[family-name:var(--font-heading)]">@vitalik replies?</div>
              <div className="flex gap-3">
                <div
                  className="flex-1 border rounded-lg p-3 text-center transition-all"
                  style={{
                    background: 'rgba(52, 211, 153, 0.1)',
                    borderColor: 'rgba(52, 211, 153, 0.3)',
                  }}
                >
                  <div className="text-xs font-[family-name:var(--font-mono)] mb-1" style={{ color: '#34D399' }}>MOON</div>
                  <div className="text-2xl font-bold font-[family-name:var(--font-mono)]">12<span className="text-sm">%</span></div>
                </div>
                <div
                  className="flex-1 border rounded-lg p-3 text-center transition-all"
                  style={{
                    background: 'rgba(251, 113, 133, 0.1)',
                    borderColor: 'rgba(251, 113, 133, 0.3)',
                  }}
                >
                  <div className="text-xs font-[family-name:var(--font-mono)] mb-1" style={{ color: '#FB7185' }}>DOOM</div>
                  <div className="text-2xl font-bold font-[family-name:var(--font-mono)]">88<span className="text-sm">%</span></div>
                </div>
              </div>
            </div>

            <div
              className="border rounded-xl p-6 transition-all duration-300 group hover:-translate-y-1 hover:border-[rgba(52,211,153,0.5)]"
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(10px)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
              }}
            >
              <div className="text-zinc-500 text-xs mb-3 font-[family-name:var(--font-mono)] uppercase tracking-wider">Market 003</div>
              <div className="font-semibold mb-4 font-[family-name:var(--font-heading)]">Goes viral?</div>
              <div className="flex gap-3">
                <div
                  className="flex-1 border rounded-lg p-3 text-center transition-all"
                  style={{
                    background: 'rgba(52, 211, 153, 0.1)',
                    borderColor: 'rgba(52, 211, 153, 0.3)',
                  }}
                >
                  <div className="text-xs font-[family-name:var(--font-mono)] mb-1" style={{ color: '#34D399' }}>MOON</div>
                  <div className="text-2xl font-bold font-[family-name:var(--font-mono)]">42<span className="text-sm">%</span></div>
                </div>
                <div
                  className="flex-1 border rounded-lg p-3 text-center transition-all"
                  style={{
                    background: 'rgba(251, 113, 133, 0.1)',
                    borderColor: 'rgba(251, 113, 133, 0.3)',
                  }}
                >
                  <div className="text-xs font-[family-name:var(--font-mono)] mb-1" style={{ color: '#FB7185' }}>DOOM</div>
                  <div className="text-2xl font-bold font-[family-name:var(--font-mono)]">58<span className="text-sm">%</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* How It Works */}
          <div
            className="border rounded-2xl p-8 md:p-10"
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(10px)',
              borderColor: 'rgba(255, 255, 255, 0.1)',
            }}
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-8">How It Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div>
                <div
                  className="w-12 h-12 border rounded-lg flex items-center justify-center mb-4 font-bold"
                  style={{
                    background: 'rgba(52, 211, 153, 0.1)',
                    borderColor: 'rgba(52, 211, 153, 0.3)',
                    color: '#34D399',
                  }}
                >
                  1
                </div>
                <div className="font-semibold mb-2">Create Market</div>
                <div className="text-sm text-zinc-400">
                  Set up a prediction on any Farcaster cast
                </div>
              </div>
              <div>
                <div
                  className="w-12 h-12 border rounded-lg flex items-center justify-center mb-4 font-bold"
                  style={{
                    background: 'rgba(52, 211, 153, 0.1)',
                    borderColor: 'rgba(52, 211, 153, 0.3)',
                    color: '#34D399',
                  }}
                >
                  2
                </div>
                <div className="font-semibold mb-2">Place Bets</div>
                <div className="text-sm text-zinc-400">
                  Users bet YES or NO with USDC
                </div>
              </div>
              <div>
                <div
                  className="w-12 h-12 border rounded-lg flex items-center justify-center mb-4 font-bold"
                  style={{
                    background: 'rgba(52, 211, 153, 0.1)',
                    borderColor: 'rgba(52, 211, 153, 0.3)',
                    color: '#34D399',
                  }}
                >
                  3
                </div>
                <div className="font-semibold mb-2">Auto-Resolve</div>
                <div className="text-sm text-zinc-400">
                  Markets resolve based on real engagement
                </div>
              </div>
              <div>
                <div
                  className="w-12 h-12 border rounded-lg flex items-center justify-center mb-4 font-bold"
                  style={{
                    background: 'rgba(52, 211, 153, 0.1)',
                    borderColor: 'rgba(52, 211, 153, 0.3)',
                    color: '#34D399',
                  }}
                >
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
