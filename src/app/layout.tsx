import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import PageTransition from '@/components/ui/PageTransition'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  applicationName: 'Crack Bounty',
  metadataBase: new URL('https://crackbounty.afficix.com'),
  title: 'Crack Bounty | Private Affiliate Network',
  description:
    "Crack Bounty connects publishers and advertisers with affiliate campaigns, performance tracking, and responsive support.",
  authors: [{ name: 'Crack Bounty', url: 'https://crackbounty.afficix.com' }],
  creator: 'Crack Bounty',
  publisher: 'Crack Bounty',
  category: 'Business',
  referrer: 'strict-origin-when-cross-origin',
  formatDetection: {
    email: false,
    telephone: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Crack Bounty',
  },
  alternates: {
    canonical: 'https://crackbounty.afficix.com',
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png', sizes: '768x768' },
    ],
    apple: [{ url: '/favicon.png', type: 'image/png', sizes: '768x768' }],
    shortcut: '/favicon.png',
  },
  manifest: '/site.webmanifest',
  openGraph: {
    title: 'Crack Bounty | Private Affiliate Network',
    description:
      'Crack Bounty connects publishers and advertisers with affiliate campaigns, performance tracking, and responsive support.',
    type: 'website',
    url: 'https://crackbounty.afficix.com',
    siteName: 'Crack Bounty',
    locale: 'en_US',
    images: [
      {
        url: 'https://crackbounty.afficix.com/favicon.png',
        secureUrl: 'https://crackbounty.afficix.com/favicon.png',
        width: 768,
        height: 768,
        alt: 'Crack Bounty brand icon',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'Crack Bounty | Private Affiliate Network',
    description:
      'Crack Bounty connects publishers and advertisers with affiliate campaigns, performance tracking, and responsive support.',
    images: ['https://crackbounty.afficix.com/favicon.png'],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#eef2f7',
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="light" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${inter.variable} font-sans antialiased`}>
        <div className="min-h-dvh">
          <PageTransition>{children}</PageTransition>
        </div>
      </body>
    </html>
  )
}