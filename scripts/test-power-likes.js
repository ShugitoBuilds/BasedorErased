require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

if (!NEYNAR_API_KEY) {
    console.error('Error: NEYNAR_API_KEY not found in environment variables.');
    process.exit(1);
}

const FAST_PATH_LIKES_THRESHOLD = 300;

async function getPowerLikes(identifier) {
    console.log(`Checking Cast: ${identifier}`);

    try {
        // 1. Resolve Cast to get Hash AND Total Likes (Fast Path Check)
        // This is the SAME logic as the optimized resolver.
        const type = identifier.startsWith('0x') ? 'hash' : 'url';
        const resolveUrl = `https://api.neynar.com/v2/farcaster/cast?identifier=${encodeURIComponent(identifier)}&type=${type}`;

        const resolveRes = await fetch(resolveUrl, { headers: { 'api_key': NEYNAR_API_KEY } });

        if (!resolveRes.ok) {
            console.error(`Resolve Error: ${await resolveRes.text()}`);
            return;
        }

        const resolveData = await resolveRes.json();
        const cast = resolveData.cast;

        if (!cast) {
            console.error('Cast not found');
            return;
        }

        const hash = cast.hash;
        const totalLikes = cast.reactions.likes_count || 0;

        console.log(`Total Likes: ${totalLikes}`);

        // --- FAST PATH ---
        if (totalLikes >= FAST_PATH_LIKES_THRESHOLD) {
            console.log(`\n⚡ FAST PATH TRIGGERED ⚡`);
            console.log(`Likes (${totalLikes}) > Threshold (${FAST_PATH_LIKES_THRESHOLD})`);
            console.log(`Result: AUTOMATICALLY BASED (MOON)`);
            console.log(`API Cost: 1 credit (This is the cheap path!)`);
            return;
        }

        console.log(`\n🐢 Slow Path Required (${totalLikes} < ${FAST_PATH_LIKES_THRESHOLD})`);
        console.log(`Fetching reactions to count power users...`);

        // --- SLOW PATH ---
        let powerLikes = 0;
        let totalLikesChecked = 0;
        let cursor = null;
        let page = 0;
        const MAX_PAGES = 5;

        do {
            const params = new URLSearchParams({
                hash: hash,
                types: 'likes',
                limit: '100',
            });
            if (cursor) params.append('cursor', cursor);

            const res = await fetch(
                `https://api.neynar.com/v2/farcaster/reactions/cast?${params.toString()}`,
                { headers: { 'api_key': NEYNAR_API_KEY } }
            );

            if (!res.ok) {
                console.error('API Error:', await res.text());
                break;
            }

            const data = await res.json();
            const reactions = data.reactions || [];
            totalLikesChecked += reactions.length;

            if (reactions.length > 0) {
                // Extract FIDs
                const fids = reactions.map(r => r.user.fid).join(',');

                console.log(`Page ${page + 1}: Checking ${reactions.length} users (Bulk Fetch)...`);

                const userRes = await fetch(
                    `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fids}`,
                    { headers: { 'api_key': NEYNAR_API_KEY } }
                );

                if (userRes.ok) {
                    const userData = await userRes.json();
                    const users = userData.users || [];

                    for (const user of users) {
                        const score = user.score || user.experimental?.neynar_user_score || 0;
                        if (score > 0.7) powerLikes++;
                    }
                }
            }

            cursor = data.next?.cursor || null;
            page++;

            if (page >= MAX_PAGES) break;

        } while (cursor);

        console.log('-----------------------------------');
        console.log(`Total Likes Checked: ${totalLikesChecked}`);
        console.log(`Power Likes Found:   ${powerLikes}`);
        console.log(`Ratio:               ${((powerLikes / totalLikesChecked) * 100).toFixed(1)}%`);
        console.log('-----------------------------------');

    } catch (err) {
        console.error('Script Error:', err);
    }
}

const TEST_HASH = '0xabd4b2e8c25396556488d0034a78cb3764833292';
const targetHash = process.argv[2] || TEST_HASH;

getPowerLikes(targetHash);
