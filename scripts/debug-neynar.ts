import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
if (!NEYNAR_API_KEY) {
    console.error('Missing NEYNAR_API_KEY');
    process.exit(1);
}

// Data from DB
const SHORT_HASH = '0x847372fe';
const USERNAME = 'j4ck.eth';

async function tryReconstructedUrl() {
    // Construct valid Warpcast URL
    const urlToCheck = `https://warpcast.com/${USERNAME}/${SHORT_HASH}`;
    console.log(`Testing Reconstructed URL: ${urlToCheck}`);

    try {
        const fetchUrl = `https://api.neynar.com/v2/farcaster/cast?identifier=${encodeURIComponent(urlToCheck)}&type=url`;
        const res = await fetch(fetchUrl, {
            headers: { 'api_key': NEYNAR_API_KEY, 'accept': 'application/json' }
        });

        if (!res.ok) {
            console.log(`  -> Failed: ${res.status}`);
            console.log('     ', (await res.text()).substring(0, 100));
            return;
        }

        const data = await res.json();
        const cast = data.cast;
        console.log(`  -> Success! Full Hash: ${cast.hash}`);
        console.log(`     Text: ${cast.text.substring(0, 20)}...`);
        console.log(`     Likes: ${cast.reactions.likes_count}`);

    } catch (err: any) {
        console.error(`  -> Error: ${err.message}`);
    }
}

tryReconstructedUrl();
