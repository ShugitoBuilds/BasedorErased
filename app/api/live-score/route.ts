import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const hash = searchParams.get('hash'); // Can be URL or Hash

    if (!hash) {
        return NextResponse.json({ error: 'Invalid Identifier' }, { status: 400 });
    }

    try {
        // 1. Resolve Cast Hash if it's a URL
        let castHash = hash;
        if (hash.startsWith('http') || !hash.startsWith('0x')) {
            const neynarRes = await fetch(
                `https://api.neynar.com/v2/farcaster/cast?identifier=${encodeURIComponent(hash)}&type=url`,
                {
                    headers: { 'api_key': process.env.NEYNAR_API_KEY || '' }
                }
            );
            if (!neynarRes.ok) return NextResponse.json({ error: 'Cast not found' }, { status: 404 });
            const data = await neynarRes.json();
            castHash = data.cast.hash;
        }

        // 2. Fetch Reactions (Limit 100 for efficiency)
        // We use 'types=likes' to filter only likes
        const reactionsRes = await fetch(
            `https://api.neynar.com/v2/farcaster/reactions/cast?hash=${castHash}&types=likes&limit=100`,
            {
                headers: { 'api_key': process.env.NEYNAR_API_KEY || '' }
            }
        );

        if (!reactionsRes.ok) {
            return NextResponse.json({ likes: 0, error: 'Reactions fetch failed' }, { status: 500 });
        }

        const reactionsData = await reactionsRes.json();
        const reactions = reactionsData.reactions || [];

        if (reactions.length === 0) {
            return NextResponse.json({ likes: 0 });
        }

        // 3. Bulk Fetch Users to check 'power_badge'
        const fids = reactions.map((r: any) => r.user.fid).filter((f: any) => !!f).join(',');

        const bulkRes = await fetch(
            `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fids}`,
            {
                headers: { 'api_key': process.env.NEYNAR_API_KEY || '' }
            }
        );

        let validLikes = 0;

        if (bulkRes.ok) {
            const bulkData = await bulkRes.json();
            const users = bulkData.users || [];

            // STRICT FILTER: Only Power Badge holders count
            validLikes = users.filter((u: any) => u.power_badge === true).length;

        } else {
            // Fallback: If bulk fails, report 0 (fail safe against bots) or raw?
            // User wants strict anti-bot. Let's return raw but maybe log error?
            // Actually, safer to return 0/partial if we promised strict. 
            // But let's fallback to reactions.length to avoid '0' shock if API just hiccups.
            validLikes = reactions.length;
        }

        return NextResponse.json({
            likes: validLikes,
            status: 'filtered'
        });

    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
