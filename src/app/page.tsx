import type { Metadata } from "next";
import HomePageClient from "./HomePageClient";

const pageTitle = "Crack Bounty | Affiliate Marketing Network";
const pageDescription =
  "Crack Bounty connects publishers and advertisers through a private affiliate network with quality offers, campaign tracking, and clear reporting.";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: {
    canonical: "https://crackbounty.afficix.com/",
  },
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    type: "website",
    url: "https://crackbounty.afficix.com/",
    siteName: "Crack Bounty",
    locale: "en_US",
    images: [
      {
        url: "https://crackbounty.afficix.com/favicon.png",
        secureUrl: "https://crackbounty.afficix.com/favicon.png",
        width: 768,
        height: 768,
        alt: "Crack Bounty brand icon",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDescription,
    images: ["https://crackbounty.afficix.com/favicon.png"],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://crackbounty.afficix.com/#organization",
      name: "Crack Bounty",
      url: "https://crackbounty.afficix.com/",
      logo: {
        "@type": "ImageObject",
        url: "https://crackbounty.afficix.com/favicon.png",
      },
      email: "contact@crackbounty.afficix.com",
      description:
        "A private affiliate network connecting publishers and advertisers with quality offers, campaign tracking, and actionable performance insights.",
      address: {
        "@type": "PostalAddress",
        streetAddress: "16192 Coastal Highway",
        addressLocality: "Lewes",
        addressRegion: "DE",
        postalCode: "19958",
        addressCountry: "US",
      },
    },
    {
      "@type": "WebSite",
      "@id": "https://crackbounty.afficix.com/#website",
      name: "Crack Bounty",
      url: "https://crackbounty.afficix.com/",
      description: pageDescription,
      publisher: { "@id": "https://crackbounty.afficix.com/#organization" },
      inLanguage: "en",
    },
    {
      "@type": "WebPage",
      "@id": "https://crackbounty.afficix.com/#webpage",
      url: "https://crackbounty.afficix.com/",
      name: pageTitle,
      description: pageDescription,
      isPartOf: { "@id": "https://crackbounty.afficix.com/#website" },
      about: { "@id": "https://crackbounty.afficix.com/#organization" },
      inLanguage: "en",
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <HomePageClient />
    </>
  );
}
