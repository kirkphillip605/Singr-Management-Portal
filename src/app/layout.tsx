import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: {
    default: 'Singr Karaoke Connect',
    template: '%s | Singr Karaoke Connect',
  },
  description: 'Professional karaoke management platform for Singr with real-time requests, multi-venue support, and OpenKJ integration. Transform your karaoke experience with modern technology.',
  keywords: [
    'karaoke',
    'singr',
    'openkj',
    'karaoke management',
    'song requests',
    'multi-venue',
    'karaoke software',
  ],
  authors: [{ name: 'Singr Karaoke' }],
  creator: 'Singr Karaoke',
  publisher: 'Singr Karaoke',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    title: 'Singr Karaoke Connect',
    description: 'Professional karaoke management platform with real-time requests, multi-venue support, and OpenKJ integration',
    siteName: 'Singr Karaoke Connect',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Singr Karaoke Connect',
    description: 'Professional karaoke management platform with real-time requests and multi-venue support',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}