'use client';

import React, { useEffect, useState } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { useSearchParams } from 'next/navigation';
import { getMarket, getMoonOdds, getDoomOdds, formatUSDC, parseUSDC } from '@/lib/contract';
import type { Market } from '@/lib/contract';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { WagmiProvider, useAccount, useWriteContract, useSwitchChain, useChainId, useReadContract, useWaitForTransactionReceipt, useConnect, useBalance } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '@/lib/wagmi';
import { parseAbi, erc20Abi, maxUint256 } from 'viem';
import { baseSepolia } from 'wagmi/chains';
import contractABI from '@/lib/contractABI.json';

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

// Safely initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

function Countdown({ deadline }: { deadline: string }) {
  const [timeLeft, setTimeLeft] = useState<string>('Loading...');

  useEffect(() => {
    function update() {
      // Deadline can be BigInt from contract or ISO string from DB
      const target = typeof deadline === 'string' ? new Date(deadline).getTime() : Number(deadline) * 1000;
      const diff = target - Date.now();
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

function generateShareUrl(betType: 'BASED' | 'ERASED', marketId: number, threshold: string): string {
  const emoji = betType === 'BASED' ? '🟢' : '🔻';
  const text = `I just bet ${betType} ${emoji} on Based or Erased!\n\nWill this cast hit ${threshold} likes?\n\nJoin the prediction: ${APP_URL}/miniapp?marketId=${marketId}`;
  return `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}`;
}

function MiniAppContent({ params }: { params: { id: string } }) {
  /* DYNAMIC MARKET ID LOGIC (Route Param) */
  const parsedId = parseInt(params.id);
  const marketId = isNaN(parsedId) ? 0 : parsedId;
  const isValidId = !isNaN(parsedId) && parsedId >= 0;

  const [context, setContext] = useState<any>(null);
  const [market, setMarket] = useState<Market | null>(null);
  const [dbMarket, setDbMarket] = useState<any>(null);
  const [moonOdds, setMoonOdds] = useState<number>(50);
  const [doomOdds, setDoomOdds] = useState<number>(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Transaction Toast Logic */
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastBetType, setLastBetType] = useState<'BASED' | 'ERASED' | null>(null);

  /* Bet Amount State */
  const [betAmount, setBetAmount] = useState<string>('5');
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
      enabled: !!address && !!market && isValidId,
    },
  });

  const userBet = rawUserBet as UserBet | undefined;

  // Centralized refresh function
  const refreshData = async () => {
    console.log('Refreshing market data...');
    if (refetchUserBet) await refetchUserBet();
    if (refetchAllowance) await refetchAllowance();

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

  // Fetch DB Market Data
  useEffect(() => {
    if (!supabase || !isValidId || marketId < 0) return;

    async function fetchDbMarket() {
      const { data, error } = await supabase!
        .from('market_index')
        .select('*')
        .eq('market_id', marketId)
        .single();

      if (error) {
        console.error('DB fetch error:', error);
      } else if (data) {
        setDbMarket(data);
      }
    }
    fetchDbMarket();
  }, [marketId, isValidId]);

  // Init App & Contract Data
  useEffect(() => {
    async function initMiniApp() {
      try {
        const appContext = await sdk.context;
        setContext(appContext);

        // Still try to get contract data but don't hard error if we have DB data
        const marketData = await getMarket(marketId);
        if (marketData) {
          setMarket(marketData);
          const moon = await getMoonOdds(marketId);
          const doom = await getDoomOdds(marketId);
          setMoonOdds(moon);
          setDoomOdds(doom);
        } else {
          console.warn(`Market #${marketId} not found on contract yet.`);
        }

        setLoading(false);
      } catch (err: any) {
        console.error('Mini App init error:', err);
        const errorMsg = err?.message || err?.name || 'Failed to initialize Mini App';
        // Only set error if we don't have DB data either
        if (!dbMarket) {
          setError(errorMsg);
        }
        setLoading(false);
      }
    }

    initMiniApp();
  }, [marketId, isValidId]);

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
          `Insufficient ETH for gas on ${REQUIRED_CHAIN_NAME}.\n` +
          `You have 0 ETH. You need a small amount of ETH on this network to pay for transaction fees.`
        );
        return;
      }

      if (usdcBalance !== undefined && usdcBalance < betAmountWei) {
        setError(
          `Insufficient USDC balance on ${REQUIRED_CHAIN_NAME}.\n` +
          `You have ${formatUSDC(usdcBalance)} USDC. You need ${betAmount} USDC to bet.`
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

  if (loading && !dbMarket) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 text-center">
        <div className="animate-pulse">Loading market...</div>
      </div>
    );
  }

  if (error && !dbMarket && !market) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 text-center">
        <h1 className="text-red-500 text-2xl font-bold mb-2">Error</h1>
        <p className="text-zinc-400 mb-4">{error}</p>
        <Link href="/miniapp" className="px-4 py-2 bg-zinc-800 rounded-lg text-white">
          Back to Hub
        </Link>
      </div>
    );
  }

  // Display Data
  const displayPfp = dbMarket?.author_pfp_url || '';
  const displayUsername = dbMarket?.author_username || 'Loading...';
  const displayText = dbMarket?.cast_text || 'Loading cast details...';
  // Use Contract deadline preferably, else DB
  const displayDeadline = market?.deadline ? market.deadline.toString() : dbMarket?.deadline;
  const displayStatus = dbMarket?.status || (market?.resolved ? 'RESOLVED' : 'ACTIVE');
  const likesCount = dbMarket?.likes_count || 0;
  const threshold = dbMarket?.threshold || market?.threshold.toString() || '0';

  return (
    <div className="min-h-screen bg-black text-white font-sans p-4 pb-24">
      {/* Back Button */}
      <Link href="/miniapp" className="inline-flex items-center text-zinc-400 mb-4 text-sm hover:text-white transition-colors">
        ← Back to Markets
      </Link>

      {/* User Info & Cast Preview */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-3 mb-4">
          {displayPfp ? (
            <img src={displayPfp} alt={displayUsername} className="w-10 h-10 rounded-full border border-zinc-700" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500" />
          )}
          <div>
            <div className="text-lg font-bold text-white">@{displayUsername}</div>
            <div className="text-xs text-zinc-500 font-mono">Market #{marketId}</div>
          </div>
        </div>

        <div className="text-zinc-200 text-lg font-medium leading-relaxed mb-4">
          {displayText.length > 200 ? (
            <span>
              {displayText.substring(0, 200)}...
              <a href={market?.castUrl || dbMarket?.cast_hash || '#'} target="_blank" rel="noopener noreferrer" className="text-purple-400 text-sm ml-1 hover:underline">Read more</a>
            </span>
          ) : (
            <span>{displayText}</span>
          )}
        </div>

        {/* Progress Bar */}
        <div className="bg-zinc-950/50 rounded-xl p-3 border border-zinc-800/50">
          <div className="flex justify-between text-xs text-zinc-400 mb-2">
            <span>Progress</span>
            <span className="text-white font-mono">{likesCount} / {threshold} Likes</span>
          </div>
          <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(100, Math.max(0, (likesCount / Number(threshold || 1)) * 100))}%`
              }}
            />
          </div>
        </div>
      </div>

      {/* Timer & Status */}
      <div className="flex justify-between items-center mb-6 px-2">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${displayStatus === 'active' ? 'bg-green-500 animate-pulse' : 'bg-zinc-500'}`} />
          <span className="text-sm font-bold tracking-wider">{displayStatus?.toUpperCase()}</span>
        </div>
        {displayDeadline && (
          <div className="text-sm font-mono text-zinc-400 bg-zinc-900 px-3 py-1 rounded-lg border border-zinc-800">
            <Countdown deadline={displayDeadline} />
          </div>
        )}
      </div>

      {/* Betting Interface */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold mb-2">Place Your Bet</h2>

        {/* Amount Selector */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <label className="text-xs text-zinc-500 uppercase font-bold mb-2 block">Amount (USDC)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              className="w-full bg-transparent text-2xl font-mono font-bold text-white focus:outline-none placeholder-zinc-700"
              placeholder="0.0"
            />
            <button
              onClick={() => setBetAmount(usdcBalance ? formatUSDC(usdcBalance) : '0')}
              className="px-2 py-1 text-xs bg-zinc-800 rounded text-zinc-400 hover:text-white"
            >
              MAX
            </button>
          </div>
          {usdcBalance !== undefined && (
            <div className="text-xs text-zinc-500 mt-2 text-right">
              Balance: {formatUSDC(usdcBalance)} USDC
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* MOON Button */}
          <button
            onClick={() => handleBet(true)}
            disabled={isConfirming || !isConnected}
            className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-500 to-green-600 p-0.5 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-left"
          >
            <div className="relative h-full w-full rounded-[14px] bg-black/10 px-4 py-6 backdrop-blur-sm transition-all group-hover:bg-opacity-0">
              <div className="text-center">
                <div className="text-3xl mb-1">🌕</div>
                <div className="text-lg font-black text-white">BASED</div>
                <div className="text-xs font-mono text-green-200 mt-1">Odds: {moonOdds}%</div>
              </div>
            </div>
          </button>

          {/* DOOM Button */}
          <button
            onClick={() => handleBet(false)}
            disabled={isConfirming || !isConnected}
            className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-500 to-red-600 p-0.5 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-left"
          >
            <div className="relative h-full w-full rounded-[14px] bg-black/10 px-4 py-6 backdrop-blur-sm transition-all group-hover:bg-opacity-0">
              <div className="text-center">
                <div className="text-3xl mb-1">💀</div>
                <div className="text-lg font-black text-white">ERASED</div>
                <div className="text-xs font-mono text-red-200 mt-1">Odds: {doomOdds}%</div>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Connect Wallet Prompt (if not connected) */}
      {!isConnected && (
        <div className="mt-8 bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 text-center">
          <p className="text-purple-200 mb-3 text-sm">Connect wallet to start betting</p>
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              onClick={() => connect({ connector })}
              className="w-full bg-purple-600 text-white font-bold py-3 rounded-xl hover:bg-purple-500 transition-all mb-2"
            >
              Connect {connector.name}
            </button>
          ))}
        </div>
      )}

      {showSuccess && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-purple-500 rounded-3xl p-6 w-full max-w-sm text-center animate-bounce-in relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-500/10 pointer-events-none" />
            <div className="text-5xl mb-4 animate-pulse">
              {lastBetType === 'BASED' ? '🌕' : '💀'}
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Bet Placed!</h3>
            <p className="text-zinc-400 mb-6">Good luck, adventurer.</p>

            <div className="flex flex-col gap-3">
              <a
                href={generateShareUrl(lastBetType!, marketId, threshold.toString())}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 bg-[#472a91] text-white font-bold rounded-xl hover:bg-[#5b3db5] transition-all flex items-center justify-center gap-2"
              >
                <span>Share on Warpcast</span>
                <span>↗</span>
              </a>
              <button
                onClick={() => setShowSuccess(false)}
                className="w-full py-3 bg-zinc-800 text-zinc-300 font-bold rounded-xl hover:bg-zinc-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Ensure the default export is wrapped with providers
export default function MiniAppPage({ params }: { params: { id: string } }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <MiniAppContent params={params} />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
