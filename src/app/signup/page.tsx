import type { Metadata } from "next"
import { Suspense } from "react"
import SignupClient from "./SignupClient"

export const metadata: Metadata = {
  metadataBase: new URL('https://crackbounty.afficix.com'),
  title: 'Join Crack Bounty | Publisher Sign Up',
  description:
    'Create a Crack Bounty publisher account to explore affiliate offers, track campaign performance, and grow your business.',
  robots: {
    index: false,
    follow: true,
  },
  alternates: {
    canonical: 'https://crackbounty.afficix.com/signup',
  },
  openGraph: {
    title: 'Join Crack Bounty | Publisher Sign Up',
    description:
      'Create a Crack Bounty publisher account to explore affiliate offers, track campaign performance, and grow your business.',
    type: 'website',
    url: 'https://crackbounty.afficix.com/signup',
    siteName: 'Crack Bounty',
    images: [
      {
        url: 'https://crackbounty.afficix.com/logo.png',
        secureUrl: 'https://crackbounty.afficix.com/logo.png',
        width: 2172,
        height: 724,
        alt: 'Crack Bounty logo',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Join Crack Bounty | Publisher Sign Up',
    description:
      'Create a Crack Bounty publisher account to explore affiliate offers, track campaign performance, and grow your business.',
    images: ['https://crackbounty.afficix.com/logo.png'],
    creator: 'Crack Bounty',
  },
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" aria-hidden="true" />}>
      <SignupClient />
    </Suspense>
  )
}
