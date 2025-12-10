import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge'; // Optional: for speed, but Node is fine too. Let's stick to default/Node if unsure about Edge env vars support. Default is safest. 
// Actually, edge is often better for simple proxies, but creates issues with some packages. Let's use Node.
export const dynamic = 'force-dynamic';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

export async function GET(req: NextRequest) {
    if (!NEYNAR_API_KEY) {
        return NextResponse.json({ error: 'Server Config Error' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const hash = searchParams.get('hash');

    if (!hash || !hash.startsWith('0x')) {
        return NextResponse.json({ error: 'Invalid Hash' }, { status: 400 });
    }

    try {
        const neynarRes = await fetch(
            `https://api.neynar.com/v2/farcaster/cast?identifier=${hash}&type=hash`,
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
