const CRACK_BOUNTY_IMAGE_ORIGIN = 'https://crackbounty.afficix.com'

export function getCrackBountyImageUrl(imageSource: string | null | undefined): string | null {
  if (!imageSource) return null

  let url: URL
  try {
    url = new URL(imageSource)
  } catch {
    return null
  }

  if (
    url.origin !== CRACK_BOUNTY_IMAGE_ORIGIN
    || url.search
    || url.hash
    || url.username
    || url.password
  ) {
    return null
  }

  return /^\/(?:preview|preview_i)\/\d+\.png$/.test(url.pathname)
    ? `${CRACK_BOUNTY_IMAGE_ORIGIN}${url.pathname}`
    : null
}

export function getCampaignImageProxyPath(campaignId: string): string {
  return `/api/campaigns/${encodeURIComponent(campaignId)}/image`
}

export function toCampaignImageSource(campaignId: string, imageSource: string): string
export function toCampaignImageSource(campaignId: string, imageSource: string | null | undefined): string | undefined
export function toCampaignImageSource(
  campaignId: string,
  imageSource: string | null | undefined,
): string | undefined {
  if (!imageSource) return undefined
  return getCrackBountyImageUrl(imageSource)
    ? getCampaignImageProxyPath(campaignId)
    : imageSource
}

export function isCampaignImageProxyPath(imageSource: string | null | undefined, campaignId: string): boolean {
  return imageSource === getCampaignImageProxyPath(campaignId)
}
