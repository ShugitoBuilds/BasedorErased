import { NextRequest, NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { createClient } from '@supabase/supabase-js';

// Vercel function config for max duration - upped to 60s
export const maxDuration = 60;
// Force dynamic to prevent caching of the easy/status response
export const dynamic = 'force-dynamic';

// Initialize Supabase Service Role
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const manualHash = searchParams.get('hash');
    const screenshotMode = searchParams.get('screenshot') === 'true';

    console.log(`[Scraper] Starting... Mode: ${manualHash ? 'Manual' : 'Auto'}`);

    try {
        let targetUrl = '';
        let marketId = -1;

        if (manualHash) {
            targetUrl = manualHash.startsWith('http') ? manualHash : `https://warpcast.com/~/conversations/${manualHash}`;
        } else {
            // Fetch the most recent active market
            const { data: markets, error: dbError } = await supabase
                .from('market_index')
                .select('*')
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(1);

            if (dbError) {
                console.error('[Scraper] DB Error:', dbError);
                return NextResponse.json({ error: 'DB Error finding market' }, { status: 500 });
            }

            if (!markets || markets.length === 0) {
                console.log('[Scraper] No active markets found.');
                return NextResponse.json({ message: 'No active markets' });
            }

            const m = markets[0];
            marketId = m.market_id;
            targetUrl = m.cast_hash.startsWith('http')
                ? m.cast_hash
                : `https://warpcast.com/${m.author_username}/${m.cast_hash}`;
        }

        console.log(`[Scraper] Target URL: ${targetUrl}`);

        let browser;
        try {
            if (process.env.NODE_ENV === 'development') {
                console.log('[Scraper] Launching Local Chrome...');
                browser = await puppeteer.launch({
                    args: ['--no-sandbox', '--disable-setuid-sandbox'],
                    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Adjust for your local OS if needed
                    headless: true
                });
            } else {
                console.log('[Scraper] Launching Serverless Chromium...');

                // OPTIMIZATIONS FOR VERCEL
                // TS Fix: Cast strictly to prevent type errors with Puppeteer v23
                const chromiumAny = chromium as any;
                chromiumAny.setGraphicsMode = false;

                browser = await puppeteer.launch({
                    args: [
                        ...chromiumAny.args,
                        '--hide-scrollbars',
                        '--disable-web-security',
                        '--no-sandbox',
                        '--disable-setuid-sandbox'
                    ],
                    defaultViewport: chromiumAny.defaultViewport,
                    executablePath: await chromiumAny.executablePath(),
                    headless: chromiumAny.headless,
                });
            }
        } catch (launchError: any) {
            console.error('[Scraper] CRITICAL: Failed to launch browser:', launchError);
            return NextResponse.json({ error: 'Browser Launch Failed', details: launchError.message }, { status: 500 });
        }

        const page = await browser.newPage();

        // Mock User Agent to avoid bot detection
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

        console.log('[Scraper] Navigating...');
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }); // Upped timeout to 20s

        let likeCount = -1;
        try {
            // Wait for the specific container that holds likes (often has href ending in /reactions)
            // We use a generous timeout because Warpcast can be slow to hydrate client-side
            await page.waitForSelector('a[href*="/reactions"]', { timeout: 8000 });

            likeCount = await page.evaluate(() => {
                // Try multiple selectors just in case
                const anchors = Array.from(document.querySelectorAll('a[href*="/reactions"]'));
                for (const a of anchors) {
                    // TS Fix: Cast to any to access innerText safely in DOM context
                    const text = (a as any).innerText || '';
                    // Look for number inside text
                    const match = text.match(/(\d+)/);
                    if (match) return parseInt(match[0], 10);
                }
                return -1;
            });
            console.log(`[Scraper] Found Likes: ${likeCount}`);
        } catch (e) {
            console.warn('[Scraper] Could not find like selector (might be 0 likes or layout changed):', e);
        }

        let screenshot = null;
        if (screenshotMode) {
            screenshot = await page.screenshot({ encoding: 'base64' });
        }

        await browser.close();

        // Update DB
        if (likeCount > -1 && marketId > -1) {
            const { error: updateError } = await supabase
                .from('market_index')
                .update({ likes_count: likeCount })
                .eq('market_id', marketId);

            if (updateError) {
                console.error('[Scraper] Failed to update DB:', updateError);
                throw updateError;
            }
            console.log('[Scraper] DB Updated Successfully');
        }

        return NextResponse.json({
            success: true,
            marketId,
            url: targetUrl,
            scraped_likes: likeCount,
            screenshot: screenshot ? '(base64_data_present)' : null
        });

    } catch (err: any) {
        console.error('[Scraper] Unhandled Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
