const AFFMINE_IMAGE_ORIGIN = 'https://network.affmine.com'

export function getAffmineImageUrl(imageSource: string | null | undefined): string | null {
  if (!imageSource) return null

  let url: URL
  try {
    url = new URL(imageSource)
  } catch {
    return null
  }

  if (
    url.origin !== AFFMINE_IMAGE_ORIGIN
    || url.search
    || url.hash
    || url.username
    || url.password
  ) {
    return null
  }

  return /^\/(?:preview|preview_i)\/\d+\.png$/.test(url.pathname)
    ? `${AFFMINE_IMAGE_ORIGIN}${url.pathname}`
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
  return getAffmineImageUrl(imageSource)
    ? getCampaignImageProxyPath(campaignId)
    : imageSource
}

export function isCampaignImageProxyPath(imageSource: string | null | undefined, campaignId: string): boolean {
  return imageSource === getCampaignImageProxyPath(campaignId)
}
