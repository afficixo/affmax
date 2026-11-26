const CRACK_BOUNTY_IMAGE_ORIGIN = 'https://crackbounty.afficix.com'
const AFFMINE_IMAGE_ORIGIN = 'https://network.affmine.com'

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

export function getAffminePreviewImageId(imageSource: string | null | undefined): string | null {
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

  return /^\/preview\/(\d{1,20})\.jpg$/.exec(url.pathname)?.[1] ?? null
}

export function getAffmineCampaignImageUrl(imageId: string): string | null {
  return /^\d{1,20}$/.test(imageId)
    ? `${AFFMINE_IMAGE_ORIGIN}/preview/${imageId}.jpg`
    : null
}

export function getAffmineImageProxyPath(imageId: string): string {
  return `/api/campaign-images/${encodeURIComponent(imageId)}`
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
  if (getCrackBountyImageUrl(imageSource)) return getCampaignImageProxyPath(campaignId)
  const affmineImageId = getAffminePreviewImageId(imageSource)
  return affmineImageId ? getAffmineImageProxyPath(affmineImageId) : imageSource
}

export function isCampaignImageProxyPath(imageSource: string | null | undefined, campaignId: string): boolean {
  return imageSource === getCampaignImageProxyPath(campaignId)
}
