import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const response = NextResponse.next();

    // The "Nuclear" Permissive CSP to fix WalletConnect & Supabase issues unconditionally.
    // We allow 'connect-src *' to ensure NO connection is ever blocked again.
    const csp = `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.farcaster.xyz;
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https:;
    font-src 'self' data:;
    connect-src * data: blob: https: wss:; 
    frame-src 'self' https://*.farcaster.xyz;
  `.replace(/\s{2,}/g, ' ').trim();

    response.headers.set('Content-Security-Policy', csp);

    return response;
}

export const config = {
    // Apply to all routes
    matcher: '/:path*',
};
