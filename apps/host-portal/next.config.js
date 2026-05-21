/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  transpilePackages: [
    '@singr/ui',
    '@singr/auth',
    '@singr/database',
    '@singr/stripe-billing',
    '@singr/config',
    '@singr/types',
  ],

  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

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

  images: {
    unoptimized: true,
    formats: ['image/avif', 'image/webp'],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      }
    }
    return config
  },
}

module.exports = nextConfig
