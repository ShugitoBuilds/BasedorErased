import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `
              default-src 'self';
              script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.farcaster.xyz;
              style-src 'self' 'unsafe-inline';
              img-src 'self' blob: data: https:;
              connect-src 'self' https: wss:; 
              font-src 'self' data:;
              frame-src 'self' https://*.farcaster.xyz;
            `.replace(/\s{2,}/g, ' ').trim(),
          },
        ],
      },
      {
        source: '/api/frame',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0',
          },
        ],
      },
      {
        source: '/api/og',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
