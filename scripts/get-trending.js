require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

async function getTrending() {
    try {
        console.log('Fetching trending...');
        const res = await fetch('https://api.neynar.com/v2/farcaster/feed/trending?limit=5', {
            headers: { 'api_key': NEYNAR_API_KEY }
        });

        if (!res.ok) {
            console.error('Error:', await res.text());
            return;
        }

        const data = await res.json();
        // Console log structure to debug
        if (data.casts) {
            console.log('Found casts (root level):', data.casts.length);
            console.log('Top Hash:', data.casts[0].hash);
        } else if (data.data && data.data.casts) { // Some APIs wrap in data
            console.log('Found casts (data.casts):', data.data.casts.length);
            console.log('Top Hash:', data.data.casts[0].hash);
        } else {
            console.log('Unknown structure:', Object.keys(data));
        }

    } catch (e) {
        console.error(e);
    }
}

getTrending();
