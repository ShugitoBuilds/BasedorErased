import { NextRequest, NextResponse } from 'next/server';
import { getMarket, getMoonOdds, getDoomOdds, formatUSDC } from '@/lib/contract';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('Frame request received:', body);

    // Extract Farcaster frame data
    const { untrustedData, trustedData } = body;
    const buttonIndex = untrustedData?.buttonIndex;
    const fid = untrustedData?.fid;
    const castId = untrustedData?.castId;

    // For MVP, show market ID 1
    // TODO: Get market ID from cast or create dynamically
    const marketId = 1;

    // Fetch market data from contract
    const market = await getMarket(marketId);

    if (!market) {
      // Market doesn't exist yet - show create market message
      let responseHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta property="fc:frame" content="vNext" />
            <meta property="fc:frame:image" content="${process.env.NEXT_PUBLIC_APP_URL}/api/og?step=no-market" />
            <meta property="fc:frame:button:1" content="No active markets" />
            <meta property="fc:frame:button:1:action" content="post" />
          </head>
        </html>
      `;

      return new NextResponse(responseHtml, {
        headers: {
          'Content-Type': 'text/html',
        },
      });
    }

    // Get current odds
    const moonOdds = await getMoonOdds(marketId);
    const doomOdds = await getDoomOdds(marketId);

    // Format pool sizes
    const moonPool = formatUSDC(market.totalMoonBets);
    const doomPool = formatUSDC(market.totalDoomBets);
    const totalPool = (parseFloat(moonPool) + parseFloat(doomPool)).toFixed(2);

    let responseHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta property="fc:frame" content="vNext" />
          <meta property="fc:frame:image" content="${process.env.NEXT_PUBLIC_APP_URL}/api/og?step=market&marketId=${marketId}&moonOdds=${moonOdds.toFixed(0)}&doomOdds=${doomOdds.toFixed(0)}&pool=${totalPool}" />
          <meta property="fc:frame:button:1" content="🌙 MOON ${moonOdds.toFixed(0)}%" />
          <meta property="fc:frame:button:1:action" content="post" />
          <meta property="fc:frame:button:2" content="💥 DOOM ${doomOdds.toFixed(0)}%" />
          <meta property="fc:frame:button:2:action" content="post" />
          <meta property="fc:frame:post_url" content="${process.env.NEXT_PUBLIC_APP_URL}/api/bet?marketId=${marketId}" />
        </head>
      </html>
    `;

    return new NextResponse(responseHtml, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    console.error('Frame error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Frame endpoint - use POST' });
}
