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
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-br from-purple-900 via-blue-900 to-black">
      <div className="max-w-4xl w-full space-y-8 text-center">
        <h1 className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">
          CastPredict
        </h1>
        <p className="text-2xl text-gray-300">
          Bet on viral moments. Trade engagement. Win big.
        </p>
        <div className="space-y-4 text-gray-400">
          <p className="text-lg">
            🎯 Will this cast hit 100 likes?
          </p>
          <p className="text-lg">
            💬 Will @vitalik reply?
          </p>
          <p className="text-lg">
            🔥 Will this go viral in 24 hours?
          </p>
        </div>
        <div className="mt-12 p-8 bg-gray-900/50 rounded-xl border border-gray-700">
          <h2 className="text-2xl font-bold text-white mb-4">How It Works</h2>
          <ol className="text-left space-y-3 text-gray-300">
            <li>1. Create a prediction market on any Farcaster cast</li>
            <li>2. Users bet YES or NO with USDC</li>
            <li>3. Market resolves automatically based on engagement</li>
            <li>4. Winners split the pot (minus 1% fee)</li>
          </ol>
        </div>
        <div className="text-sm text-gray-500 mt-8">
          <p>Built on Base • Powered by Farcaster Frames v2</p>
        </div>
      </div>
    </main>
  );
}
