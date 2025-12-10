import { NextRequest, NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { createClient } from '@supabase/supabase-js';

// Vercel function config for max duration
export const maxDuration = 60;

// Initialize Supabase Service Role
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const manualHash = searchParams.get('hash');
    const screenshotMode = searchParams.get('screenshot') === 'true';

    try {
        console.log('--- Starting Scraper ---');

        // 1. Determine Target URL
        let targetUrl = '';
        let marketId = -1;

        if (manualHash) {
            targetUrl = manualHash.startsWith('http') ? manualHash : `https://warpcast.com/~/conversations/${manualHash}`;
        } else {
            const { data: markets } = await supabase
                .from('market_index')
                .select('*')
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(1);

            if (!markets || markets.length === 0) {
                return NextResponse.json({ message: 'No active markets' });
            }

            const m = markets[0];
            marketId = m.market_id;
            if (m.cast_hash.startsWith('http')) {
                targetUrl = m.cast_hash;
            } else {
                targetUrl = `https://warpcast.com/${m.author_username}/${m.cast_hash}`;
            }
        }

        console.log(`Target: ${targetUrl}`);

        // 2. Launch Puppeteer
        let browser;
        if (process.env.NODE_ENV === 'development') {
            // Local Dev Fallback (needs Chrome installed)
            browser = await puppeteer.launch({
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
                executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                headless: true
            });
        } else {
            // Production (Vercel)
            // Fix: Cast chromium to any to avoid type error on defaultViewport
            browser = await puppeteer.launch({
                args: chromium.args,
                defaultViewport: (chromium as any).defaultViewport,
                executablePath: await chromium.executablePath(),
                headless: chromium.headless,
            });
        }

        const page = await browser.newPage();
        await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 15000 });

        // 3. Extract Likes
        let likeCount = -1;
        try {
            await page.waitForSelector('a[href*="/reactions"]', { timeout: 5000 });
            likeCount = await page.evaluate(() => {
                const anchors = Array.from(document.querySelectorAll('a[href*="/reactions"]'));
                for (const a of anchors) {
                    const text = a.innerText;
                    const match = text.match(/(\d+)/);
                    if (match) return parseInt(match[0], 10);
                }
                return -1;
            });
        } catch (e) {
            console.log('Error finding selector:', e);
        }

        let screenshot = null;
        if (screenshotMode) {
            screenshot = await page.screenshot({ encoding: 'base64' });
        }

        await browser.close();

        // 4. Update Database
        if (likeCount > -1 && marketId > -1) {
            const { error: updateError } = await supabase
                .from('market_index')
                .update({ likes_count: likeCount })
                .eq('market_id', marketId);

            if (updateError) throw updateError;
        }

        return NextResponse.json({
            success: true,
            marketId,
            url: targetUrl,
            scraped_likes: likeCount,
            screenshot: screenshot ? '(base64_data_present)' : null
        });

    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
