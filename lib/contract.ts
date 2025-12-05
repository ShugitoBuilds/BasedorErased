import { createPublicClient, http, formatUnits, parseUnits } from 'viem';
import { baseSepolia } from 'viem/chains';
import contractABI from './contractABI.json';

// Contract addresses
export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
export const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;

// Create public client for reading from contract
export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

// Market type matching Solidity struct
export interface Market {
  id: bigint;
  castUrl: string;
  threshold: bigint;
  deadline: bigint;
  totalMoonBets: bigint;
  totalDoomBets: bigint;
  outcome: number; // 0 = UNRESOLVED, 1 = MOON, 2 = DOOM
  resolved: boolean;
  creator: string;
}

/**
 * Get market details from contract
 */
export async function getMarket(marketId: number): Promise<Market | null> {
  try {
    const market = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: contractABI,
      functionName: 'getMarket',
      args: [BigInt(marketId)],
    }) as any;

    // Check if market exists (id !== 0)
    if (market.id === 0n) {
      return null;
    }

    return {
      id: market.id,
      castUrl: market.castUrl,
      threshold: market.threshold,
      deadline: market.deadline,
      totalMoonBets: market.totalMoonBets,
      totalDoomBets: market.totalDoomBets,
      outcome: market.outcome,
      resolved: market.resolved,
      creator: market.creator,
    };
  } catch (error) {
    console.error('Error fetching market:', error);
    return null;
  }
}

/**
 * Get MOON odds as a percentage (0-100)
 */
export async function getMoonOdds(marketId: number): Promise<number> {
  try {
    const odds = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: contractABI,
      functionName: 'getMoonOdds',
      args: [BigInt(marketId)],
    }) as bigint;

    // Convert from basis points (0-10000) to percentage (0-100)
    return Number(odds) / 100;
  } catch (error) {
    console.error('Error fetching odds:', error);
    return 50; // Default to 50/50
  }
}

/**
 * Get DOOM odds as a percentage (0-100)
 */
export async function getDoomOdds(marketId: number): Promise<number> {
  const moonOdds = await getMoonOdds(marketId);
  return 100 - moonOdds;
}

/**
 * Calculate potential winnings for a bet
 */
export async function calculatePotentialWinnings(
  marketId: number,
  amount: string, // USDC amount as string (e.g., "10.5")
  isMoon: boolean
): Promise<string> {
  try {
    const amountWei = parseUnits(amount, 6); // USDC has 6 decimals

    const winnings = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: contractABI,
      functionName: 'calculatePotentialWinnings',
      args: [BigInt(marketId), amountWei, isMoon],
    }) as bigint;

    return formatUnits(winnings, 6);
  } catch (error) {
    console.error('Error calculating winnings:', error);
    return '0';
  }
}

/**
 * Format USDC amount from wei to human-readable
 */
export function formatUSDC(amountWei: bigint): string {
  return formatUnits(amountWei, 6);
}

/**
 * Parse USDC amount from human-readable to wei
 */
export function parseUSDC(amount: string): bigint {
  return parseUnits(amount, 6);
}

/**
 * Check if market is still open for betting
 */
export function isMarketOpen(market: Market): boolean {
  const now = BigInt(Math.floor(Date.now() / 1000));
  return !market.resolved && market.deadline > now;
}

/**
 * Get human-readable outcome
 */
export function getOutcomeString(outcome: number): string {
  switch (outcome) {
    case 0:
      return 'Unresolved';
    case 1:
      return 'MOON';
    case 2:
      return 'DOOM';
    default:
      return 'Unknown';
  }
}
