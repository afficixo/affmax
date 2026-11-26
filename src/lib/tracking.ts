/** Crack Bounty-style publisher tracking → main offer postback mapping. */

export const DEFAULT_MAIN_OFFER_BASE = 'https://www.af9m8trk.com/6HH112BV/UQ711VGP/'

function normalizeOrigin(value: string | undefined | null): string {
  const raw = (value || '').trim()
  if (!raw) return ''
  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`)
    return url.origin
  } catch {
    return ''
  }
}

/** Public tracking origin from env (`TRACKING_DOMAIN` / `NEXT_PUBLIC_TRACKING_DOMAIN`). */
export function getTrackingDomainOrigin(): string {
  return normalizeOrigin(
    process.env.NEXT_PUBLIC_TRACKING_DOMAIN
    || process.env.TRACKING_DOMAIN
    || '',
  )
}

export function getTrackingDomainHost(): string {
  const origin = getTrackingDomainOrigin()
  if (!origin) return ''
  try {
    return new URL(origin).host.toLowerCase()
  } catch {
    return ''
  }
}

/** App origin host (`APP_URL` / `NEXT_PUBLIC_APP_URL`), used when tracking shares the app domain. */
export function getAppDomainHost(): string {
  const origin = normalizeOrigin(
    process.env.NEXT_PUBLIC_APP_URL
    || process.env.APP_URL
    || '',
  )
  if (!origin) return ''
  try {
    return new URL(origin).host.toLowerCase()
  } catch {
    return ''
  }
}

function hostKey(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, '')
}

/** True when TRACKING_DOMAIN points at the same host as the main app (common in local/dev). */
export function isSharedTrackingAppHost(requestHost?: string | null): boolean {
  const tracking = hostKey(getTrackingDomainHost())
  if (!tracking) return false
  const app = hostKey(getAppDomainHost())
  const request = hostKey(requestHost || '')
  if (app && tracking === app) return true
  if (request && tracking === request) return true
  return false
}

export function sanitizeTrackingToken(value: string | number | null | undefined): string {
  return String(value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .slice(0, 100)
}

export type TrackingIdPrefix = 'P' | 'O'

export function encodeTrackingId(value: string | number, prefix: TrackingIdPrefix): string {
  const token = sanitizeTrackingToken(value)
  return /^\d+$/.test(token) ? `${prefix}${BigInt(token).toString(16).toUpperCase()}` : token
}

export function decodeTrackingId(value: string, prefix: TrackingIdPrefix): string {
  const token = sanitizeTrackingToken(value)
  const hexMatch = token.match(new RegExp(`^${prefix}([0-9a-f]+)$`, 'i'))
    || token.match(/^0x([0-9a-f]+)$/i)
  return hexMatch ? BigInt(`0x${hexMatch[1]}`).toString(10) : token
}

export function isHexTrackingId(value: string, prefix: TrackingIdPrefix): boolean {
  return new RegExp(`^${prefix}[0-9a-f]+$`, 'i').test(value)
    || /^0x[0-9a-f]+$/i.test(value)
}

export type PublicTrackingParts = {
  publisherId: string | number
  offerId: string | number
  subId1?: string
  subId2?: string
  subId3?: string
}

/** Publisher-facing link: https://tracking-domain/{publisher}/{offer}/?s1=&s2=&s3= */
export function buildPublicTrackingUrl(parts: PublicTrackingParts, origin = getTrackingDomainOrigin()): string {
  const publisherId = encodeTrackingId(parts.publisherId, 'P')
  const offerId = encodeTrackingId(parts.offerId, 'O')
  if (!origin || !publisherId || !offerId) return ''

  // No trailing slash — avoids an extra 308 before the track rewrite.
  const url = new URL(`${origin.replace(/\/$/, '')}/${publisherId}/${offerId}`)
  const sub1 = parts.subId1?.trim()
  const sub2 = parts.subId2?.trim()
  const sub3 = parts.subId3?.trim()
  if (sub1) url.searchParams.set('s1', sub1)
  if (sub2) url.searchParams.set('s2', sub2)
  if (sub3) url.searchParams.set('s3', sub3)
  return url.toString()
}

export type MainOfferParts = {
  mainOfferBase: string
  publisherId: string | number
  subId1?: string
  subId2?: string
  subId3?: string
}

/**
 * Hidden network link used for postbacks:
 * {main}?{existing_network_params}&s1={publisher_id}&s2={sub1}&s3={sub2}&s4={sub3}
 */
export function buildMainOfferUrl(parts: MainOfferParts): string {
  const base = (parts.mainOfferBase || DEFAULT_MAIN_OFFER_BASE).trim() || DEFAULT_MAIN_OFFER_BASE
  let url: URL
  try {
    url = new URL(base)
  } catch {
    url = new URL(DEFAULT_MAIN_OFFER_BASE)
  }

  // Preserve network parameters (such as Affmine's p/o) while adding our tracking map.
  url.searchParams.set('s1', sanitizeTrackingToken(parts.publisherId))
  const sub1 = parts.subId1?.trim()
  const sub2 = parts.subId2?.trim()
  const sub3 = parts.subId3?.trim()
  url.searchParams.set('s2', sub1 || '')
  url.searchParams.set('s3', sub2 || '')
  url.searchParams.set('s4', sub3 || '')
  return url.toString()
}

export function isTrackingPath(pathname: string): { publisherId: string; offerId: string } | null {
  const match = pathname.match(/^\/([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)\/?$/)
  if (!match) return null
  const publisherId = match[1]
  const offerId = match[2]
  // Avoid colliding with known app roots when tracking domain == app domain.
  const reserved = new Set([
    'api', 'dashboard', 'campaigns', 'account', 'payments', 'support', 'login', 'signup',
    'reports', 'terms', 'privacy', 'incentive_offers', 'contentlocker', 'offerwall',
    'tools', 'locker', 'wall', 'crackbounty', '_next', 'favicon.ico',
  ])
  if (reserved.has(publisherId.toLowerCase())) return null
  return { publisherId, offerId }
}
