import type { NextConfig } from 'next';
import path from 'node:path';

const basePath = '/mtc';

const config: NextConfig = {
  basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  output: 'standalone',
  outputFileTracingRoot: path.resolve(process.cwd(), '../..'),
  turbopack: { root: path.resolve(process.cwd(), '../..') },
};
export default config;
