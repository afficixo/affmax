/** Global S2S example using the conversion fields required by this app. */
export const PUBLISHER_POSTBACK_URL_EXAMPLE =
  'http://example.com/postback.php'
  + '?datetime=#datetime#&campaign=#cmpname#&campaign_id=#cmpid#'
  + '&country=#country#&s1=#s1#&s2=#s2#&ip=#ip#&revenue=#payout#&status=#status#&test=#test#'

export function isPublisherGlobalPostbackActive(
  url: string | null | undefined,
  enabled: boolean | null | undefined,
): boolean {
  return Boolean(url?.trim()) && enabled !== false
}

export type MarketplacePostbackTokens = {
  s1: string
  s2: string
  s3: string
  s4: string
  ip: string
}

export const DEFAULT_MARKETPLACE_POSTBACK_TOKENS: MarketplacePostbackTokens = {
  s1: '#s1#',
  s2: '#s2#',
  s3: '#s3#',
  s4: '#s4#',
  ip: '#ip#',
}
