import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  turbopack: {
    resolveAlias: {
      '@std/testing/mock': './src/lib/shims/empty-module.ts',
      '@std/testing/bdd': './src/lib/shims/empty-module.ts',
      '@gadicc/fetch-mock-cache/runtimes/deno.ts': './src/lib/shims/empty-module.ts',
      '@gadicc/fetch-mock-cache/stores/fs.ts': './src/lib/shims/empty-module.ts',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    // Fix yahoo-finance2 test file imports that reference Deno-specific modules
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@std/testing/mock': './src/lib/shims/empty-module.ts',
        '@std/testing/bdd': './src/lib/shims/empty-module.ts',
        '@gadicc/fetch-mock-cache/runtimes/deno.ts': './src/lib/shims/empty-module.ts',
        '@gadicc/fetch-mock-cache/stores/fs.ts': './src/lib/shims/empty-module.ts',
      };
    }
    return config;
  },
};

export default nextConfig;
