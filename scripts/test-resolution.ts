import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const CRON_SECRET = process.env.CRON_SECRET;

async function trigger() {
    console.log('Triggering Market Resolution...');
    try {
        const res = await fetch('http://localhost:3000/api/cron/resolve', {
            headers: { 'Authorization': `Bearer ${CRON_SECRET}` }
        });

        console.log(`Status: ${res.status}`);
        const text = await res.text();
        console.log(`Response: ${text}`);
    } catch (err) {
        console.error(err);
    }
}

trigger();
