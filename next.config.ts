import type { NextConfig } from 'next'
import { merchantImageRemotePatterns } from './src/merchants/image-hosts'

const nextConfig: NextConfig = {
  // Standalone output is bedoeld voor het Docker-image (klein, zonder pnpm store)
  // en wordt daar met `node server.js` gestart. Lokaal draait `pnpm start` de
  // gewone server, want `next start` ondersteunt standalone output niet.
  output: process.env.NEXT_OUTPUT_STANDALONE === '1' ? 'standalone' : undefined,
  reactStrictMode: true,
  poweredByHeader: false,
  // Development draait vaak op 127.0.0.1 (bijvoorbeeld in de e2e-tests); Next
  // blokkeert anders de dev-assets omdat het als andere origin wordt gezien.
  allowedDevOrigins: ['localhost', '127.0.0.1'],
  images: {
    remotePatterns: [...merchantImageRemotePatterns],
    formats: ['image/webp'],
  },
}

export default nextConfig
