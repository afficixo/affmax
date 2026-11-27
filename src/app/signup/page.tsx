import type { Metadata } from "next"
import { Suspense } from "react"
import SignupClient from "./SignupClient"

export const metadata: Metadata = {
  title: 'Join Crack Bounty as a Publisher | Sign Up',
  description:
    'Apply to join Crack Bounty as a publisher. Create an account to explore affiliate campaigns, track performance, and manage your publisher profile.',
  robots: {
    index: false,
    follow: true,
    googleBot: {
      index: false,
      follow: true,
    },
  },
  alternates: {
    canonical: '/signup',
  },
  openGraph: {
    title: 'Join Crack Bounty as a Publisher | Sign Up',
    description:
      'Apply to join Crack Bounty as a publisher. Create an account to explore affiliate campaigns, track performance, and manage your publisher profile.',
    type: 'website',
    url: 'https://crackbounty.afficix.com/signup',
    siteName: 'Crack Bounty',
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
    title: 'Join Crack Bounty as a Publisher | Sign Up',
    description:
      'Apply to join Crack Bounty as a publisher. Create an account to explore affiliate campaigns, track performance, and manage your publisher profile.',
    images: ['https://crackbounty.afficix.com/favicon.png'],
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
