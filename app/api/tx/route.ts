import { NextRequest, NextResponse } from 'next/server';
import { encodeFunctionData, createPublicClient, http, erc20Abi, maxUint256 } from 'viem';
import { baseSepolia } from 'viem/chains';
import { parseUSDC } from '@/lib/contract';
import contractABI from '@/lib/contractABI.json';

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const marketId = parseInt(url.searchParams.get('marketId') || '1');
    const isMoon = url.searchParams.get('isMoon') === 'true';

    // Get user address from Frame message (mocked for now as we need to parse the body)
    // In a real implementation, we should parse the Frame Request body to get the `untrustedData.address`
    // However, for tx frames, the address is often passed in the query params or we need to parse the body
    const body = await req.json();
    const userAddress = body?.untrustedData?.address as `0x${string}`;

    if (!userAddress) {
      return NextResponse.json({ error: 'User address not found' }, { status: 400 });
    }

    // For MVP, use fixed bet amount of 1 USDC
    const betAmount = '1';
    const betAmountWei = parseUSDC(betAmount);

    // Check allowance
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(),
    });

    const allowance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [userAddress, CONTRACT_ADDRESS],
    });

    let calldata;
    let to;
    let value = '0';

    if (allowance < betAmountWei) {
      // Need to approve
      console.log('Frame: Approving USDC');
      to = USDC_ADDRESS;
      calldata = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [CONTRACT_ADDRESS, maxUint256],
      });
    } else {
      // Place bet
      console.log('Frame: Placing bet');
      to = CONTRACT_ADDRESS;
      calldata = encodeFunctionData({
        abi: contractABI,
        functionName: isMoon ? 'betMoon' : 'betDoom',
        args: [BigInt(marketId), betAmountWei],
      });
    }

    // Return transaction data in Farcaster Frame format
    return NextResponse.json({
      chainId: `eip155:${process.env.NEXT_PUBLIC_CHAIN_ID}`, // Base Sepolia chainId
      method: 'eth_sendTransaction',
      params: {
        abi: allowance < betAmountWei ? erc20Abi : contractABI,
        to: to,
        data: calldata,
        value: value,
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
