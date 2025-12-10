
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

export async function GET(req: NextRequest) {
    if (!NEYNAR_API_KEY) {
        return NextResponse.json({ error: 'Server Config Error' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const hash = searchParams.get('hash');

    if (!hash) {
        return NextResponse.json({ error: 'Invalid Identifier' }, { status: 400 });
    }

    // New logic: Support URL or Hash
    const isUrl = hash.startsWith('http');
    const type = isUrl ? 'url' : 'hash';
    const identifier = encodeURIComponent(hash);

    try {
        const neynarRes = await fetch(
            `https://api.neynar.com/v2/farcaster/cast?identifier=${identifier}&type=${type}`,
            {
                headers: {
                    'api_key': NEYNAR_API_KEY,
                    'accept': 'application/json'
                },
                next: { revalidate: 10 } // Next.js 13+ fetch caching
            }
        );

        if (!neynarRes.ok) {
            // If 404, maybe cast deleted. Return 0 likes.
            if (neynarRes.status === 404) {
                return NextResponse.json({ likes: 0, status: 'not_found' });
            }
            return NextResponse.json({ error: 'Neynar Error' }, { status: neynarRes.status });
        }

        const data = await neynarRes.json();
        const cast = data.cast;
        const likes = cast.reactions?.likes_count || 0;

        // Return with Cache headers for browser/CDN
        return NextResponse.json(
            { likes, timestamp: Date.now() },
            {
                status: 200,
                headers: {
                    'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=59'
                }
            }
        );

    } catch (err: any) {
        console.error('Live Score Error:', err);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
