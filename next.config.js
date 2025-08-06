/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  env: {
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    NEXT_PUBLIC_GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  },
  async rewrites() {
    return [
      {
        source: '/api/openkj/:path*',
        destination: '/api/openkj/:path*',
      },
    ];
  },
};

module.exports = nextConfig;