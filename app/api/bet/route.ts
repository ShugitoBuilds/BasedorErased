import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('Bet request:', body);

    const { untrustedData } = body;
    const buttonIndex = untrustedData?.buttonIndex;
    const fid = untrustedData?.fid;

    // Button 1 = YES, Button 2 = NO
    const betType = buttonIndex === 1 ? 'YES' : 'NO';

    console.log(`User ${fid} bet ${betType}`);

    // For MVP, just show confirmation
    // Later: this will interact with smart contracts

    const responseHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta property="fc:frame" content="vNext" />
          <meta property="fc:frame:image" content="${process.env.NEXT_PUBLIC_APP_URL}/api/og?step=confirm&bet=${betType}" />
          <meta property="fc:frame:button:1" content="Bet Placed! ✅" />
          <meta property="fc:frame:button:1:action" content="post" />
          <meta property="fc:frame:button:2" content="Share" />
          <meta property="fc:frame:button:2:action" content="link" />
          <meta property="fc:frame:button:2:target" content="https://warpcast.com" />
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
