import { NextRequest, NextResponse } from 'next/server';
import { getMarket, formatUSDC, parseUSDC } from '@/lib/contract';
import { encodeFunctionData } from 'viem';
import contractABI from '@/lib/contractABI.json';

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = new URL(req.url);
    const marketId = parseInt(url.searchParams.get('marketId') || '1');

    console.log('Bet request:', body);

    const { untrustedData } = body;
    const buttonIndex = untrustedData?.buttonIndex;
    const fid = untrustedData?.fid;

    // Button 1 = MOON, Button 2 = DOOM
    const isMoon = buttonIndex === 1;
    const betType = isMoon ? 'MOON' : 'DOOM';

    console.log(`User ${fid} betting ${betType} on market ${marketId}`);

    // Fetch market to verify it exists
    const market = await getMarket(marketId);
    if (!market) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 });
    }

    // For MVP, use fixed bet amount of 1 USDC
    const betAmount = '1'; // 1 USDC
    const betAmountWei = parseUSDC(betAmount);

    // Encode the bet transaction
    const betData = encodeFunctionData({
      abi: contractABI,
      functionName: isMoon ? 'betMoon' : 'betDoom',
      args: [BigInt(marketId), betAmountWei],
    });

    // Encode USDC approval transaction
    const approvalData = encodeFunctionData({
      abi: [
        {
          name: 'approve',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
          ],
          outputs: [{ type: 'bool' }],
        },
      ],
      functionName: 'approve',
      args: [CONTRACT_ADDRESS, betAmountWei],
    });

    // Return Frame with transaction button
    const responseHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta property="fc:frame" content="vNext" />
          <meta property="fc:frame:image" content="${process.env.NEXT_PUBLIC_APP_URL}/api/og?step=bet&bet=${betType}&amount=${betAmount}" />
          <meta property="fc:frame:button:1" content="Place ${betAmount} USDC Bet" />
          <meta property="fc:frame:button:1:action" content="tx" />
          <meta property="fc:frame:button:1:target" content="${process.env.NEXT_PUBLIC_APP_URL}/api/tx?marketId=${marketId}&isMoon=${isMoon}" />
          <meta property="fc:frame:button:2" content="Cancel" />
          <meta property="fc:frame:button:2:action" content="post" />
          <meta property="fc:frame:post_url" content="${process.env.NEXT_PUBLIC_APP_URL}/api/frame" />
        </head>
      </html>
    `;

    return new NextResponse(responseHtml, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    console.error('Bet error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
