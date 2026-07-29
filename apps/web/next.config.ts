import type { NextConfig } from 'next';
import path from 'node:path';

// @fkknv/shared načítavame priamo z TS zdroja (SWC ho transpiluje). Vyhneme sa
// tým problému Fast Refresh s CommonJS dist balíkom a web nepotrebuje build dist.
const sharedSrc = path.resolve(process.cwd(), '../../packages/shared/src');

const nextConfig: NextConfig = {
  transpilePackages: ['@fkknv/shared'],
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = { ...(config.resolve.alias ?? {}), '@fkknv/shared': sharedSrc };
    return config;
  },
};

export default nextConfig;
