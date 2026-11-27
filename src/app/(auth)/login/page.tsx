import type { Metadata } from "next";
import { Suspense } from "react";
import LoginClient from "./LoginClient";

export const metadata: Metadata = {
  metadataBase: new URL('https://crackbounty.afficix.com'),
  title: 'Publisher Login — Crack Bounty',
  description:
    'Log in to your Crack Bounty publisher account to manage campaigns, performance, and payouts.',
  robots: {
    index: false,
    follow: true,
  },
  alternates: {
    canonical: 'https://crackbounty.afficix.com/login',
  },
  openGraph: {
    title: 'Publisher Login — Crack Bounty',
    description:
      'Log in to your Crack Bounty publisher account to manage campaigns, performance, and payouts.',
    type: 'website',
    url: 'https://crackbounty.afficix.com/login',
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
    card: 'summary_large_image',
    title: 'Publisher Login — Crack Bounty',
    description:
      'Log in to your Crack Bounty publisher account to manage campaigns, performance, and payouts.',
    images: ['https://crackbounty.afficix.com/favicon.png'],
    creator: 'Crack Bounty',
  },
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" aria-hidden="true" />}>
      <LoginClient />
    </Suspense>
  );
}
