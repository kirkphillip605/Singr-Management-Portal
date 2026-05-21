import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Singr API',
  description: 'OpenKJ-compatible API for Singr Karaoke Connect.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
