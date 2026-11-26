import type { MetadataRoute } from 'next'

const siteUrl = 'https://crackbounty.afficix.com'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${siteUrl}/` },
    { url: `${siteUrl}/login` },
    { url: `${siteUrl}/signup` },
    { url: `${siteUrl}/terms` },
    { url: `${siteUrl}/privacy` },
  ]
}
