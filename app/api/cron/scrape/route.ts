import { NextRequest, NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium-min';
import puppeteer from 'puppeteer-core';
import { createClient } from '@supabase/supabase-js';

// Vercel function config for max duration - upped to 60s
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const manualHash = searchParams.get('hash');

    console.log(`[Scraper v126] Starting... Mode: ${manualHash ? 'Manual' : 'Auto'}`);

    try {
        let targetUrl = '';
        let marketId = -1;

        if (manualHash) {
            targetUrl = manualHash.startsWith('http') ? manualHash : `https://warpcast.com/~/conversations/${manualHash}`;
        } else {
            const { data: markets, error: dbError } = await supabase
                .from('market_index')
                .select('*')
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(1);

            if (dbError) {
                console.error('[Scraper] DB Error:', dbError);
                return NextResponse.json({ error: 'DB Error' }, { status: 500 });
            }

            if (!markets || markets.length === 0) {
                console.log('[Scraper] No active markets.');
                return NextResponse.json({ message: 'No active markets' });
            }

            const m = markets[0];
            marketId = m.market_id;
            targetUrl = m.cast_hash.startsWith('http') ? m.cast_hash : `https://warpcast.com/${m.author_username}/${m.cast_hash}`;
        }

        console.log(`[Scraper] Target: ${targetUrl}`);

        let browser;
        try {
            if (process.env.NODE_ENV === 'development') {
                browser = await puppeteer.launch({
                    args: ['--no-sandbox', '--disable-setuid-sandbox'],
                    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                    headless: true
                });
            } else {
                // v126 Stable Config
                // URL must match the installed version (v126.0.0)
                const remotePack = "https://github.com/Sparticuz/chromium/releases/download/v126.0.0/chromium-v126.0.0-pack.tar";
                
                const chromiumAny = chromium as any;
                chromiumAny.setGraphicsMode = false;

                browser = await puppeteer.launch({
                    args: [
                        ...chromiumAny.args,
                        '--hide-scrollbars',
                        '--disable-web-security',
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-gpu'
                    ],
                    // Use remoteTarball for on-demand download
                    executablePath: await chromiumAny.executablePath(remotePack),
                    headless: chromiumAny.headless,
                    defaultViewport: chromiumAny.defaultViewport,
                });
            }
        } catch (launchError: any) {
            console.error('[Scraper] Launch Error:', launchError);
            return NextResponse.json({ error: 'Launch Failed', details: launchError.message }, { status: 500 });
        }

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
        
        console.log('[Scraper] Navigating...');
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });

        let likeCount = -1;
        try {
            await page.waitForSelector('a[href*="/reactions"]', { timeout: 10000 });
            likeCount = await page.evaluate(() => {
                const anchors = Array.from(document.querySelectorAll('a[href*="/reactions"]'));
                for (const a of anchors) {
                    const text = (a as any).innerText || '';
                    const match = text.match(/(\d+)/);
                    if (match) return parseInt(match[0], 10);
                }
                return -1;
            });
            console.log(`[Scraper] Found Likes: ${likeCount}`);
        } catch (e) {
            console.warn('[Scraper] Selector timeout:', e);
        }

        await browser.close();

        if (likeCount > -1 && marketId > -1) {
            await supabase.from('market_index').update({ likes_count: likeCount }).eq('market_id', marketId);
        }

        return NextResponse.json({ success: true, url: targetUrl, scraped_likes: likeCount });

    } catch (err: any) {
        console.error('[Scraper] Unhandled:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
