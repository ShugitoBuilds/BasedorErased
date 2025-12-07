'use client';

import React, { useEffect, useState } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { useSearchParams } from 'next/navigation';
import { getMarket, getMoonOdds, getDoomOdds, formatUSDC, parseUSDC } from '@/lib/contract';
import { WagmiProvider, useAccount, useWriteContract, useSwitchChain, useChainId, useReadContract, useWaitForTransactionReceipt, useConnect, useBalance } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '@/lib/wagmi';
import { parseAbi, erc20Abi, maxUint256 } from 'viem';
import { baseSepolia } from 'wagmi/chains';
import contractABI from '@/lib/contractABI.json';

// Import Market type from contract lib
import type { Market } from '@/lib/contract';

interface UserBet {
  moonAmount: bigint;
  doomAmount: bigint;
  claimed: boolean;
}

const queryClient = new QueryClient();

const REQUIRED_CHAIN_ID = 84532; // Base Sepolia
const REQUIRED_CHAIN_NAME = 'Base Sepolia';
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://basedorerased.vercel.app';

/**
 * Generate Warpcast share URL for a bet
 */
function generateShareUrl(betType: 'BASED' | 'ERASED', marketId: number, threshold: string): string {
  const emoji = betType === 'BASED' ? '🟢' : '🔻';
  const text = `I just bet ${betType} ${emoji} on Based or Erased!\n\nWill this cast hit ${threshold} likes?\n\nJoin the prediction: ${APP_URL}/miniapp?marketId=${marketId}`;
  return `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}`;
}

function MiniAppContent({ params }: { params: { id: string } }) {
  /* DYNAMIC MARKET ID LOGIC (Route Param) */
  const marketId = parseInt(params.id);

  const [context, setContext] = useState<any>(null);
  const [market, setMarket] = useState<Market | null>(null);
  const [moonOdds, setMoonOdds] = useState<number>(50);
  const [doomOdds, setDoomOdds] = useState<number>(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Transaction Toast Logic */
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastBetType, setLastBetType] = useState<'BASED' | 'ERASED' | null>(null);

  /* Bet Amount State */
  const [betAmount, setBetAmount] = useState<string>('5'); // Default 5 USDC
  const MAX_BET = 500;
  const MIN_BET = 1;

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync, data: hash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const { connect, connectors } = useConnect();

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address ? [address, CONTRACT_ADDRESS] : undefined,
    query: {
      enabled: !!address,
    },
  });

  const { data: usdcBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  const { data: ethBalance } = useBalance({
    address: address,
  });

  // Get User Bet
  const { data: rawUserBet, refetch: refetchUserBet } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: contractABI,
    functionName: 'getUserBet',
    args: address ? [BigInt(marketId), address] : undefined,
    query: {
      enabled: !!address && !!market,
    },
  });

  const userBet = rawUserBet as UserBet | undefined;

  // Centralized refresh function
  const refreshData = async () => {
    console.log('Refreshing market data...');
    if (refetchUserBet) await refetchUserBet();
    if (refetchAllowance) await refetchAllowance();

    // Refresh global market data
    try {
      const updatedMarket = await getMarket(marketId);
      if (updatedMarket) {
        setMarket(updatedMarket);
        const moon = await getMoonOdds(marketId);
        const doom = await getDoomOdds(marketId);
        setMoonOdds(moon);
        setDoomOdds(doom);
      }
    } catch (e) {
      console.error("Error refreshing market:", e);
    }
  };

  // Effect to handle transaction confirmation updates with retries
  useEffect(() => {
    if (isConfirmed) {
      setShowSuccess(true);
      refreshData();
      const t1 = setTimeout(refreshData, 1000);
      const t2 = setTimeout(refreshData, 4000);
      const timer = setTimeout(() => setShowSuccess(false), 10000);
      return () => {
        clearTimeout(timer);
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [isConfirmed, marketId, refetchUserBet, refetchAllowance]);

  const isWrongNetwork = chainId !== REQUIRED_CHAIN_ID;

  useEffect(() => {
    async function initMiniApp() {
      try {
        const appContext = await sdk.context;
        setContext(appContext);

        const marketData = await getMarket(marketId);
        if (marketData) {
          setMarket(marketData);
          const moon = await getMoonOdds(marketId);
          const doom = await getDoomOdds(marketId);
          setMoonOdds(moon);
          setDoomOdds(doom);
        } else {
          setError(`Market #${marketId} not found.`);
        }

        setLoading(false);
        await sdk.actions.ready();
      } catch (err: any) {
        console.error('Mini App init error:', err);
        const errorMsg = err?.message || err?.name || 'Failed to initialize Mini App';
        setError(errorMsg);
        setLoading(false);
      }
    }

    initMiniApp();
  }, [marketId]);

  const handleSwitchNetwork = async () => {
    try {
      if (!switchChain) return;
      await switchChain({ chainId: REQUIRED_CHAIN_ID });
    } catch (err: any) {
      console.error('Switch network error:', err);
      const errorMsg = err?.message || err?.name || 'Unknown error';
      setError('Failed to switch network: ' + errorMsg);
    }
  };

  const handleClaim = async () => {
    if (!isConnected || !address) return;
    try {
      console.log('Claiming winnings...');
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: contractABI,
        functionName: 'claimWinnings',
        args: [BigInt(marketId)],
      });
    } catch (err) {
      console.error('Claim error:', err);
      setError('Failed to claim winnings');
    }
  };

  const handleBet = async (isMoon: boolean) => {
    if (!isConnected) {
      setError('Wallet not connected. Please select a wallet to connect.');
      return;
    }
    if (!address) {
      setError('No wallet address found.');
      return;
    }
    if (isWrongNetwork) {
      switchChain({ chainId: REQUIRED_CHAIN_ID });
      return;
    }

    // Validate Amount
    const amountNum = parseFloat(betAmount);
    if (isNaN(amountNum) || amountNum < MIN_BET) {
      setError(`Minimum bet is ${MIN_BET} USDC`);
      return;
    }
    if (amountNum > MAX_BET) {
      setError(`Maximum bet is ${MAX_BET} USDC to protect liquidity.`);
      return;
    }

    try {
      const betAmountWei = parseUSDC(betAmount);

      if (ethBalance && ethBalance.value === 0n) {
        setError(
          `Insufficient ETH for gas on ${REQUIRED_CHAIN_NAME}. \n` +
          `You have 0 ETH. You need a small amount of ETH on this network to pay for transaction fees.\n` +
          `Please switch to a wallet that has Base Sepolia ETH, or fund this wallet.`
        );
        return;
      }

      if (usdcBalance !== undefined && usdcBalance < betAmountWei) {
        setError(
          `Insufficient USDC balance on ${REQUIRED_CHAIN_NAME}. \n` +
          `You have ${formatUSDC(usdcBalance)} USDC. You need ${betAmount} USDC to bet.\n` +
          `Please switch to a wallet with testnet USDC, or use a faucet.`
        );
        return;
      }

      if (!allowance || allowance < betAmountWei) {
        console.log('Approving USDC...');
        await writeContractAsync({
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: 'approve',
          args: [CONTRACT_ADDRESS, maxUint256],
        });
        return;
      }

      console.log(`Betting ${isMoon ? 'BASED' : 'ERASED'}...`);
      setLastBetType(isMoon ? 'BASED' : 'ERASED');
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: contractABI,
        functionName: isMoon ? 'betMoon' : 'betDoom',
        args: [BigInt(marketId), betAmountWei],
      });
    } catch (err) {
      console.error('Bet error:', err);
      setError('Failed to place bet. Please check your wallet for details.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center font-sans">
        <div className="text-center animate-pulse">
          <div className="text-6xl mb-6">🌙</div>
          <div className="text-xl font-medium text-zinc-400">Loading Market...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 font-sans">
        <div className="text-center max-w-md w-full bg-zinc-900/50 p-8 rounded-3xl border border-red-500/20 backdrop-blur-xl">
          <div className="text-5xl mb-6">⚠️</div>
          <h2 className="text-xl font-bold mb-2 text-red-500">Action Required</h2>
          <p className="text-sm text-zinc-400 whitespace-pre-wrap mb-8 leading-relaxed">{error}</p>
          <button
            onClick={() => setError(null)}
            className="w-full py-3 bg-red-500/10 text-red-500 rounded-xl font-bold hover:bg-red-500/20 transition-all active:scale-95"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 font-sans">
        <div className="text-center">
          <div className="text-6xl mb-6">🔍</div>
          <div className="text-xl text-zinc-400">No market found</div>
        </div>
      </div>
    );
  }

  const totalPool = formatUSDC(market.totalMoonBets + market.totalDoomBets);

  return (
    <div
      className="min-h-screen text-white font-sans flex flex-col items-center"
      style={{
        background: 'radial-gradient(circle at 50% 0%, #1a1a1a 0%, #000000 100%)',
      }}
    >
      <div className="w-full max-w-md p-4 flex flex-col gap-4">
        {/* Header */}
        <div className="text-center pt-2 flex justify-center">
          <img
            src="/header.png"
            alt="Based or Erased"
            className="h-24 w-auto object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] hover:scale-105 transition-transform duration-500"
          />
        </div>

        {/* Transaction Status */}
        {isConfirming && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex items-center gap-3 animate-pulse">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-blue-400 font-medium text-xs">Processing transaction...</span>
          </div>
        )}
        {showSuccess && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="flex items-center gap-3 mb-2">
              <div className="text-green-500 text-sm">✓</div>
              <span className="text-green-400 font-medium text-xs">Transaction confirmed!</span>
            </div>
            {lastBetType && market && (
              <a
                href={generateShareUrl(lastBetType, marketId, market.threshold.toString())}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg font-bold text-xs transition-all active:scale-95"
              >
                <span>🟣</span>
                <span>Share on Farcaster</span>
              </a>
            )}
          </div>
        )}

        {/* Connect Wallet Options */}
        {!isConnected && (
          <div className="text-center p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800 backdrop-blur-md">
            <h3 className="text-sm font-bold mb-3 text-zinc-200">Connect Wallet</h3>
            <div className="flex flex-col gap-2">
              {connectors.map((connector) => (
                <button
                  key={connector.id}
                  onClick={() => connect({ connector })}
                  className="w-full bg-white text-black px-4 py-2.5 rounded-lg font-bold hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-white/5 text-sm"
                >
                  {connector.name.toLowerCase().includes('farcaster') && <span>🟣</span>}
                  {connector.name.toLowerCase().includes('metamask') && <span>🦊</span>}
                  <span>Connect {connector.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Market Card with Betting Interface */}
        <div className="relative group perspective-1000">
          <div
            className="absolute -inset-0.5 bg-gradient-to-r from-teal-500/20 to-rose-500/20 rounded-3xl blur opacity-75 group-hover:opacity-100 transition duration-1000"
          ></div>
          <div className="relative rounded-3xl bg-[#0A0A0A] border border-zinc-800/50 p-5 backdrop-blur-xl ring-1 ring-white/10 flex flex-col gap-4">
            {/* Market Info */}
            <div>
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase bg-zinc-900 px-2 py-0.5 rounded">
                  Market #{marketId}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => refreshData()}
                    disabled={loading}
                    className="text-[10px] font-medium text-zinc-500 hover:text-white transition-colors flex items-center gap-1"
                  >
                    🔄 Refresh
                  </button>
                  <span className="text-[10px] font-medium text-zinc-400 flex items-center gap-1">
                    Pool: <span className="text-white font-bold">{totalPool} USDC</span>
                  </span>
                </div>
              </div>

              <h2 className="text-lg font-bold leading-tight mb-2 text-zinc-100">
                Will this cast hit <span className="text-white border-b border-zinc-700">{market.threshold.toString()} likes</span>?
              </h2>

              <a
                href={market.castUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors group/link mb-4"
              >
                View Cast <span className="group-hover/link:translate-x-0.5 transition-transform">→</span>
              </a>
            </div>

            {/* Betting Interface */}
            <div className="flex flex-col gap-3">
              {/* Amount Input */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-zinc-500 font-bold">$</span>
                </div>
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  min="1"
                  max="500"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-8 pr-12 text-white font-bold placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-700 transition-all text-lg"
                  placeholder="Amount"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span className="text-zinc-500 text-xs font-bold">USDC</span>
                </div>
              </div>

              {/* Betting Buttons Grid */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleBet(true)}
                  disabled={!isConnected || isConfirming}
                  className="relative overflow-hidden p-3 rounded-xl border border-green-500/30 bg-gradient-to-br from-green-500/10 to-green-500/5 group hover:border-green-500/50 hover:from-green-500/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 text-left"
                >
                  <div className="absolute inset-0 bg-green-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="relative z-10 flex flex-col">
                    <span className="text-[10px] font-bold text-green-400 tracking-widest mb-1">BASED 🟢</span>
                    <span className="text-2xl font-black text-white leading-none">
                      {Math.round(moonOdds)}%
                    </span>
                  </div>
                </button>

                <button
                  onClick={() => handleBet(false)}
                  disabled={!isConnected || isConfirming}
                  className="relative overflow-hidden p-3 rounded-xl border border-red-500/30 bg-gradient-to-br from-red-500/10 to-red-500/5 group hover:border-red-500/50 hover:from-red-500/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 text-left"
                >
                  <div className="absolute inset-0 bg-red-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="relative z-10 flex flex-col">
                    <span className="text-[10px] font-bold text-red-500 tracking-widest mb-1">ERASED 🔻</span>
                    <span className="text-2xl font-black text-white leading-none">
                      {Math.round(doomOdds)}%
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Compact My Bets */}
        {isConnected && userBet && (userBet.moonAmount > 0n || userBet.doomAmount > 0n) && (
          <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Your Bets</h3>
              {userBet?.claimed && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/20 uppercase">
                  Paid
                </span>
              )}
            </div>

            <div className="flex gap-2">
              {userBet?.moonAmount && userBet.moonAmount > 0n && (
                <div className="flex-1 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-green-400">BASED</span>
                  <span className="text-sm font-bold text-white">{formatUSDC(userBet.moonAmount)} $</span>
                </div>
              )}
              {userBet?.doomAmount && userBet.doomAmount > 0n && (
                <div className="flex-1 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-red-400">ERASED</span>
                  <span className="text-sm font-bold text-white">{formatUSDC(userBet.doomAmount)} $</span>
                </div>
              )}
            </div>

            {market?.resolved && !userBet?.claimed && (
              (market.outcome === 1 && userBet.moonAmount > 0n) ||
              (market.outcome === 2 && userBet.doomAmount > 0n)
            ) && (
                <button
                  onClick={handleClaim}
                  className="w-full mt-3 py-2.5 rounded-lg font-bold text-sm text-black bg-white hover:bg-zinc-100 hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
                >
                  🎉 Claim Winnings
                </button>
              )}
          </div>
        )}

        {/* Network Error */}
        {isWrongNetwork && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              <span className="text-red-400 font-medium text-sm">Wrong Network</span>
            </div>
            <button
              onClick={handleSwitchNetwork}
              className="w-full py-1.5 bg-red-500/20 text-red-500 rounded-lg font-bold text-sm hover:bg-red-500/30 transition-colors"
            >
              Switch to {REQUIRED_CHAIN_NAME}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MarketPage({ params }: { params: { id: string } }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <div style={{ display: 'contents' }}>
          <React.Suspense fallback={
            <div className="min-h-screen bg-black text-white flex items-center justify-center font-sans">
              <div className="animate-pulse text-zinc-500">Loading App...</div>
            </div>
          }>
            <MiniAppContent params={params} />
          </React.Suspense>
        </div>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
