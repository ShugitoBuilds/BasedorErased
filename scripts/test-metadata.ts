
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const CAST_URL = 'https://warpcast.com/dwr/0x5c74f5'; // Valid cast (dwr)

async function testMetadata() {
    if (!NEYNAR_API_KEY) {
        console.error('Missing NEYNAR_API_KEY');
        process.exit(1);
    }

    console.log('Testing Neynar Metadata Fetch...');
    console.log('URL:', CAST_URL);

    try {
        const neynarRes = await fetch(
            `https://api.neynar.com/v2/farcaster/cast?identifier=${encodeURIComponent(CAST_URL)}&type=url`,
            { headers: { 'api_key': NEYNAR_API_KEY, 'accept': 'application/json' } }
        );

        if (neynarRes.ok) {
            const data = await neynarRes.json();
            const cast = data.cast;
            console.log('--- Success ---');
            console.log('Author:', cast.author.username);
            console.log('Text:', cast.text);
            console.log('PFP:', cast.author.pfp_url);
        } else {
            console.error('Failed:', await neynarRes.text());
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

testMetadata();
