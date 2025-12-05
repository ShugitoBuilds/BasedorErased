'use client';

import { useEffect, useState } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { getMarket, getMoonOdds, getDoomOdds, formatUSDC, parseUSDC } from '@/lib/contract';
import { createWalletClient, custom, parseAbi } from 'viem';
import { baseSepolia } from 'viem/chains';
import contractABI from '@/lib/contractABI.json';

// Import Market type from contract lib
import type { Market } from '@/lib/contract';

export default function MiniAppPage() {
  const [context, setContext] = useState<any>(null);
  const [market, setMarket] = useState<Market | null>(null);
  const [moonOdds, setMoonOdds] = useState<number>(50);
  const [doomOdds, setDoomOdds] = useState<number>(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentChainId, setCurrentChainId] = useState<number | null>(null);
  const [isWrongNetwork, setIsWrongNetwork] = useState(false);

  const REQUIRED_CHAIN_ID = 84532; // Base Sepolia
  const REQUIRED_CHAIN_NAME = 'Base Sepolia';

  useEffect(() => {
    async function initMiniApp() {
      try {
        // Get context from Farcaster
        const appContext = await sdk.context;
        setContext(appContext);

        // Check wallet network
        const provider = sdk.wallet?.ethProvider;
        if (provider) {
          const chainId = await provider.request({ method: 'eth_chainId' });
          const chainIdNum = parseInt(chainId as string, 16);
          setCurrentChainId(chainIdNum);
          setIsWrongNetwork(chainIdNum !== REQUIRED_CHAIN_ID);
        }

        // Load market data
        const marketData = await getMarket(1); // Market ID 1
        if (marketData) {
          setMarket(marketData);
          const moon = await getMoonOdds(1);
          const doom = await getDoomOdds(1);
          setMoonOdds(moon);
          setDoomOdds(doom);
        }

        setLoading(false);

        // Signal to Farcaster that we're ready
        await sdk.actions.ready();
      } catch (err: any) {
        console.error('Mini App init error:', err);
        const errorMsg = err?.message || err?.name || 'Failed to initialize Mini App';
        setError(errorMsg);
        setLoading(false);
      }
    }

    initMiniApp();
  }, []);

  const handleSwitchNetwork = async () => {
    try {
      const provider = sdk.wallet?.ethProvider;
      if (!provider) return;

      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${REQUIRED_CHAIN_ID.toString(16)}` }],
      });

      // Refresh chain ID
      const chainId = await provider.request({ method: 'eth_chainId' });
      const chainIdNum = parseInt(chainId as string, 16);
      setCurrentChainId(chainIdNum);
      setIsWrongNetwork(chainIdNum !== REQUIRED_CHAIN_ID);
    } catch (err: any) {
      console.error('Switch network error:', err);
      const errorMsg = err?.message || err?.name || 'Unknown error';
      setError('Failed to switch network: ' + errorMsg);
    }
  };

  const handleBet = async (isMoon: boolean) => {
    try {
      setError(null);

      // Get Ethereum provider from SDK (automatically available)
      const provider = sdk.wallet?.ethProvider;
      if (!provider) {
        throw new Error('Wallet not available. Please connect a wallet in your Farcaster client.');
      }

      // Check network before betting
      if (isWrongNetwork) {
        throw new Error(`Please switch to ${REQUIRED_CHAIN_NAME} to place bets`);
      }

      // Create wallet client
      const walletClient = createWalletClient({
        chain: baseSepolia,
        transport: custom(provider),
      });

      const [account] = await walletClient.getAddresses();
      if (!account) {
        throw new Error('No account found');
      }

      const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
      const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;
      const betAmount = parseUSDC('1'); // 1 USDC

      // Step 1: Approve USDC
      const approveHash = await walletClient.writeContract({
        address: USDC_ADDRESS,
        abi: parseAbi(['function approve(address spender, uint256 amount) returns (bool)']),
        functionName: 'approve',
        args: [CONTRACT_ADDRESS, betAmount],
        account,
      });

      console.log('Approval tx:', approveHash);

      // Step 2: Place bet
      const betHash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: contractABI as any,
        functionName: isMoon ? 'betMoon' : 'betDoom',
        args: [BigInt(1), betAmount], // Market ID 1
        account,
      });

      console.log('Bet tx:', betHash);

      alert(`Success! Bet placed on ${isMoon ? 'MOON' : 'DOOM'}\\n\\nTx: ${betHash.slice(0, 10)}...`);

      // Reload market data
      setTimeout(async () => {
        const marketData = await getMarket(1);
        if (marketData) {
          setMarket(marketData);
          const moon = await getMoonOdds(1);
          const doom = await getDoomOdds(1);
          setMoonOdds(moon);
          setDoomOdds(doom);
        }
      }, 3000);
    } catch (err: any) {
      console.error('Bet error:', err);
      const errorMsg = err?.message || err?.name || 'Failed to place bet';
      setError(errorMsg);
      alert('Error: ' + errorMsg);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🌙💥</div>
          <div className="text-xl">Loading Moon or Doom...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <div className="text-xl mb-2">Error</div>
          <div className="text-sm text-zinc-400">{error}</div>
        </div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-4xl mb-4">🔍</div>
          <div className="text-xl">No market found</div>
        </div>
      </div>
    );
  }

  const totalPool = formatUSDC(market.totalMoonBets + market.totalDoomBets);

  return (
    <div
      className="min-h-screen text-white p-6"
      style={{ background: 'radial-gradient(circle at center, #0a0a0a 0%, #000000 100%)' }}
    >
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="text-3xl">🌙</div>
          <div className="text-xs absolute translate-y-3 translate-x-3">💥</div>
        </div>
        <h1 className="text-3xl font-bold mb-2">Moon or Doom</h1>
        {context?.user && (
          <div className="text-sm text-zinc-400">
            Hey, @{context.user.username || context.user.fid}!
          </div>
        )}
      </div>

      {/* Market Info */}
      <div
        className="border rounded-2xl p-6 mb-6"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(10px)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
        }}
      >
        <div className="text-sm text-zinc-500 mb-2">Market #1</div>
        <div className="text-lg font-semibold mb-4">
          Will this cast hit {market.threshold.toString()} likes?
        </div>

        <div className="text-sm text-zinc-400 mb-4">
          Total Pool: {totalPool} USDC
        </div>

        <a
          href={market.castUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-400 hover:underline"
        >
          View Cast →
        </a>
      </div>

      {/* Network Warning */}
      {isWrongNetwork && (
        <div
          className="border rounded-xl p-6 mb-6"
          style={{
            background: 'rgba(251, 113, 133, 0.1)',
            borderColor: 'rgba(251, 113, 133, 0.3)',
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="text-2xl">⚠️</div>
            <div>
              <div className="font-semibold" style={{ color: '#FB7185' }}>
                Wrong Network
              </div>
              <div className="text-sm text-zinc-400">
                You're on {currentChainId === 8453 ? 'Base Mainnet' : `Chain ${currentChainId}`}
              </div>
            </div>
          </div>
          <button
            onClick={handleSwitchNetwork}
            className="w-full py-3 px-4 rounded-lg font-semibold transition-all hover:scale-105 active:scale-95"
            style={{
              background: 'rgba(251, 113, 133, 0.2)',
              border: '1px solid rgba(251, 113, 133, 0.5)',
              color: '#FB7185',
            }}
          >
            Switch to {REQUIRED_CHAIN_NAME}
          </button>
        </div>
      )}

      {/* Betting Options */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <button
          onClick={() => handleBet(true)}
          className="border rounded-xl p-6 transition-all duration-300 hover:scale-105 active:scale-95"
          style={{
            background: 'rgba(52, 211, 153, 0.1)',
            borderColor: 'rgba(52, 211, 153, 0.3)',
          }}
        >
          <div className="text-xs font-mono mb-2" style={{ color: '#34D399' }}>
            MOON
          </div>
          <div className="text-4xl font-bold font-mono mb-2">
            {moonOdds}
            <span className="text-lg">%</span>
          </div>
          <div className="text-xs text-zinc-400">
            Pool: {formatUSDC(market.totalMoonBets)} USDC
          </div>
        </button>

        <button
          onClick={() => handleBet(false)}
          className="border rounded-xl p-6 transition-all duration-300 hover:scale-105 active:scale-95"
          style={{
            background: 'rgba(251, 113, 133, 0.1)',
            borderColor: 'rgba(251, 113, 133, 0.3)',
          }}
        >
          <div className="text-xs font-mono mb-2" style={{ color: '#FB7185' }}>
            DOOM
          </div>
          <div className="text-4xl font-bold font-mono mb-2">
            {doomOdds}
            <span className="text-lg">%</span>
          </div>
          <div className="text-xs text-zinc-400">
            Pool: {formatUSDC(market.totalDoomBets)} USDC
          </div>
        </button>
      </div>

      {/* Info */}
      <div
        className="border rounded-xl p-4 text-sm"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
        }}
      >
        <div className="text-zinc-500 mb-2">How it works:</div>
        <div className="text-zinc-400 space-y-1 text-xs">
          <div>• Bet 1 USDC on MOON or DOOM</div>
          <div>• Market resolves based on actual engagement</div>
          <div>• Winners split the pot (1% fee)</div>
        </div>
      </div>
    </div>
  );
}
