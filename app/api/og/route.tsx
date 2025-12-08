import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const step = searchParams.get('step') || 'home';
    const prediction = searchParams.get('prediction') || 'Will this cast hit 100 likes in 24h?';
    const yesOdds = searchParams.get('yesOdds') || '65';
    const noOdds = searchParams.get('noOdds') || '35';

    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://basedorerased.vercel.app';

    // Fetch image to safely render in Edge
    const logoUrl = `${APP_URL}/based-or-erased-coin.png`;
    const logoData = await fetch(logoUrl).then((res) => res.arrayBuffer()).catch(() => null);

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0a0a0a',
            padding: '40px',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '24px',
              padding: '60px',
              width: '90%',
              maxWidth: '900px',
            }}
          >
            {/* Render Logo from Buffer if available, else fallback to text or empty */}
            {logoData ? (
              <img
                src={logoData as any}
                width="600"
                height="600"
                style={{
                  objectFit: 'contain',
                  marginBottom: '20px',
                  width: '600px',
                  height: '600px',
                }}
              />
            ) : (
              <div style={{ color: 'white', fontSize: 60 }}>Based or Erased</div>
            )}


            {step === 'market' ? (
              <>
                <p
                  style={{
                    fontSize: '36px',
                    color: '#e0e0e0',
                    marginBottom: '40px',
                    textAlign: 'center',
                    maxWidth: '800px',
                  }}
                >
                  {prediction}
                </p>

                <div
                  style={{
                    display: 'flex',
                    gap: '40px',
                    marginTop: '20px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      background: 'rgba(52, 211, 153, 0.2)',
                      padding: '30px 60px',
                      borderRadius: '16px',
                      border: '2px solid rgba(52, 211, 153, 0.3)',
                    }}
                  >
                    <span style={{ fontSize: '48px', color: '#34D399' }}>MOON</span>
                    <span style={{ fontSize: '56px', fontWeight: 'bold', color: 'white' }}>
                      {yesOdds}%
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      background: 'rgba(251, 113, 133, 0.2)',
                      padding: '30px 60px',
                      borderRadius: '16px',
                      border: '2px solid rgba(251, 113, 133, 0.3)',
                    }}
                  >
                    <span style={{ fontSize: '48px', color: '#FB7185' }}>DOOM</span>
                    <span style={{ fontSize: '56px', fontWeight: 'bold', color: 'white' }}>
                      {noOdds}%
                    </span>
                  </div>
                </div>
              </>
            ) : null}

          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error) {
    console.error('OG image generation error:', error);
    return new Response('Failed to generate image', { status: 500 });
  }
}
