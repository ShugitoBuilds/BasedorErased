import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const step = searchParams.get('step') || 'home';
    const prediction = searchParams.get('prediction') || 'Will this cast hit 100 likes in 24h?';
    const yesOdds = searchParams.get('yesOdds') || '65';
    const noOdds = searchParams.get('noOdds') || '35';

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
            background: '#000000',
            padding: '40px',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.6)',
              borderRadius: '24px',
              padding: '60px',
              width: '90%',
              maxWidth: '900px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                marginBottom: '20px',
              }}
            >
              <div
                style={{
                  fontSize: '48px',
                  marginRight: '8px',
                }}
              >
                🌙💥
              </div>
              <h1
                style={{
                  fontSize: '72px',
                  fontWeight: 'bold',
                  color: 'white',
                }}
              >
                Moon or Doom
              </h1>
            </div>

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
            ) : (
              <>
                <p
                  style={{
                    fontSize: '40px',
                    color: '#e0e0e0',
                    marginBottom: '20px',
                    textAlign: 'center',
                  }}
                >
                  Bet on Viral Moments
                </p>
                <p
                  style={{
                    fontSize: '28px',
                    color: '#a0a0a0',
                    textAlign: 'center',
                  }}
                >
                  Turn engagement into trading opportunities
                </p>
              </>
            )}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    console.error('OG image generation error:', error);
    return new Response('Failed to generate image', { status: 500 });
  }
}
