/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow Replit's proxied preview origin for cross-origin requests
  allowedDevOrigins: ['*.replit.dev', '*.replit.app', '*.riker.replit.dev'],

  // Next.js 15 optimizations
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  
  // Enable experimental features for Next.js 15
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // Keep these CommonJS / native packages out of the Webpack bundle so
  // Next.js loads them at runtime via `require()`. This silences the
  // "Critical dependency: the request of a dependency is an expression"
  // warnings emitted by Prisma's optional OpenTelemetry instrumentation
  // and the Sentry SDK on every build.
  serverExternalPackages: [
    '@prisma/client',
    '@prisma/instrumentation',
    '@sentry/nextjs',
    '@opentelemetry/instrumentation',
    'argon2',
    'bcryptjs',
    'twilio',
    'nodemailer',
    'stripe',
  ],

  // Image optimization
  images: {
    path: "/_next/image",
    unoptimized: true,
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Security and performance headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'geolocation=*'
          },
          // CORS for the public API surface is set per-request by the
          // host-aware middleware in `src/middleware.ts` (it echoes the
          // caller's origin against an allow-list and adds
          // `Access-Control-Allow-Credentials`). A blanket
          // `Access-Control-Allow-Origin: *` here would be incompatible
          // with credentialed requests from the host portal.
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: '/api/openkj/:path*',
        destination: '/api/openkj/:path*',
      },
    ];
  },

  // Webpack optimizations
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
