
const https = require('https');

function fetchUrl(url) {
    https.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            console.log(`Redirecting to: ${res.headers.location}`);
            fetchUrl(res.headers.location);
            return;
        }

        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            console.log('Status:', res.statusCode);
            // Check for metadata
            const metaPattern = /<meta[^>]*content="([^"]*199[^"]*)"/i;
            const match = data.match(metaPattern);
            if (match) {
                console.log('SUCCESS: Found "199" in metadata:', match[0]);
            } else if (data.includes('199') || data.includes('likes')) {
                console.log('SUCCESS: Found "199" in raw HTML body.');
                const idx = data.indexOf('199');
                console.log('Context:', data.substring(idx - 50, idx + 50));
            } else {
                console.log('FAILURE: Count still not found in HTML.');
            }
        });
    }).on('error', (err) => {
        console.log('Error:', err.message);
    });
}

fetchUrl('https://warpcast.com/ted/0x3fb41d');
