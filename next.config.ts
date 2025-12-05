import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.warpcast.com https://warpcast.com https://*.coinbase.com https://wallet.coinbase.com https://*.walletconnect.com https://*.walletconnect.org wss://*.walletconnect.com wss://*.walletconnect.org https://*.base.org https://base-sepolia.g.alchemy.com https://base-mainnet.g.alchemy.com",
              "frame-src 'self' https://*.coinbase.com https://wallet.coinbase.com",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
