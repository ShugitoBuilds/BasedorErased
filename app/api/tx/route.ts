import { NextRequest, NextResponse } from 'next/server';
import { encodeFunctionData } from 'viem';
import { parseUSDC } from '@/lib/contract';
import contractABI from '@/lib/contractABI.json';

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const marketId = parseInt(url.searchParams.get('marketId') || '1');
    const isMoon = url.searchParams.get('isMoon') === 'true';

    // For MVP, use fixed bet amount of 1 USDC
    const betAmount = '1';
    const betAmountWei = parseUSDC(betAmount);

    // Encode the bet transaction
    const calldata = encodeFunctionData({
      abi: contractABI,
      functionName: isMoon ? 'betMoon' : 'betDoom',
      args: [BigInt(marketId), betAmountWei],
    });

    // Return transaction data in Farcaster Frame format
    return NextResponse.json({
      chainId: `eip155:${process.env.NEXT_PUBLIC_CHAIN_ID}`, // Base Sepolia chainId
      method: 'eth_sendTransaction',
      params: {
        abi: contractABI,
        to: CONTRACT_ADDRESS,
        data: calldata,
        value: '0',
      },
    });
  } catch (error) {
    console.error('Transaction error:', error);
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Use POST method' }, { status: 405 });
}
