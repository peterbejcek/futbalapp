import type { NextConfig } from 'next';
import path from 'node:path';

// @fkknv/shared načítavame priamo z TS zdroja (SWC ho transpiluje). Vyhneme sa
// tým problému Fast Refresh s CommonJS dist balíkom a web nepotrebuje build dist.
const sharedSrc = path.resolve(process.cwd(), '../../packages/shared/src');

const nextConfig: NextConfig = {
  transpilePackages: ['@fkknv/shared'],
  images: { formats: ['image/avif', 'image/webp'] },
  async headers() {
    const noindex = [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }];
    return [
      { source: '/portal/:path*', headers: noindex },
      { source: '/prihlasenie', headers: noindex },
      { source: '/reset-hesla', headers: noindex },
    ];
  },
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = { ...(config.resolve.alias ?? {}), '@fkknv/shared': sharedSrc };
    return config;
  },
};

export default nextConfig;
