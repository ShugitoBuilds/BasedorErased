import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    // FEATURE DISABLED FOR MVP
    // User requested to comment out/remove scraper functionality.
    return NextResponse.json({ 
        message: 'Scraper disabled for MVP',
        status: 'disabled'
    });
}
