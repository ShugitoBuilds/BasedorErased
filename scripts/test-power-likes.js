require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

if (!NEYNAR_API_KEY) {
    console.error('Error: NEYNAR_API_KEY not found in environment variables.');
    process.exit(1);
}

async function getPowerLikes(castHash) {
    console.log(`Checking Power Likes for Cast: ${castHash}`);

    let powerLikes = 0;
    let totalLikesChecked = 0;
    let cursor = null;
    let page = 0;
    const MAX_PAGES = 5;

    try {
        do {
            const params = new URLSearchParams({
                hash: castHash,
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

                    if (users.length > 0 && page === 0) {
                        try {
                            console.log('DEBUG: First User Score:', users[0].score);
                        } catch (e) { }
                    }

                    for (const user of users) {
                        // Use Score as Proxy. High score = Power User.
                        // Threshold 0.9 is safer for "Power User", 0.7 for testing.
                        const score = user.score || user.experimental?.neynar_user_score || 0;
                        if (score > 0.7) {
                            powerLikes++;
                        }
                    }
                } else {
                    console.error('User Bulk Fetch Error:', await userRes.text());
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
