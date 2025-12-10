
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

async function debug(urlOrHash: string) {
    console.log(`Debug: ${urlOrHash}`);

    // 1. Cast
    const isUrl = urlOrHash.startsWith('http');
    const type = isUrl ? 'url' : 'hash';
    const identifier = encodeURIComponent(urlOrHash);
    const castUrl = `https://api.neynar.com/v2/farcaster/cast?identifier=${identifier}&type=${type}`;
    console.log(`Fetching Cast: ${castUrl}`);

    const res = await fetch(castUrl, { headers: { 'api_key': NEYNAR_API_KEY!, 'accept': 'application/json' } });
    if (!res.ok) {
        console.error('Error fetching cast:', res.status, await res.text());
        return;
    }

    const data = await res.json();
    const hash = data.cast.hash;
    console.log(`Cast Hash: ${hash}`);

    // 2. Reactions
    const detailsUrl = `https://api.neynar.com/v2/farcaster/reactions/cast?hash=${hash}&types=likes&limit=5`;
    const detailsRes = await fetch(detailsUrl, { headers: { 'api_key': NEYNAR_API_KEY!, 'accept': 'application/json' } });

    if (detailsRes.ok) {
        const d = await detailsRes.json();
        const reactions = d.reactions;
        console.log(`Reactions: ${reactions.length}`);

        const fids = reactions.map((r: any) => r.user.fid).join(',');

        // 3. Bulk Users
        const bulkUrl = `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fids}`;
        const bulkRes = await fetch(bulkUrl, { headers: { 'api_key': NEYNAR_API_KEY!, 'accept': 'application/json' } });

        if (bulkRes.ok) {
            const b = await bulkRes.json();
            const users = b.users;

            console.log('--- USER KEYS ---');
            console.log(Object.keys(users[0]));
            console.log('--- USER SAMPLE ---');
            console.log(JSON.stringify(users[0], null, 2));

            let powerCount = 0;
            users.forEach((u: any) => { if (u.power_badge) powerCount++; });
            console.log(`Power Badges (Sample): ${powerCount} / ${users.length}`);
        } else {
            console.error('Bulk Error:', await bulkRes.text());
        }

    } else {
        console.error('Reactions Error:', await detailsRes.text());
    }
}
const arg = process.argv[2];
if (arg) debug(arg);
