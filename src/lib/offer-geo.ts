import type { IncentiveWidgetOffer } from './incentive-tools'

const GLOBAL_GEO_CODES = new Set(['ALL', 'GLOBAL', 'INTL', 'INTERNATIONAL', 'WORLD', 'WORLDWIDE'])

function normalizeCountryCode(value: string | null | undefined) {
  const countryCode = value?.trim().toUpperCase()
  return countryCode && /^[A-Z]{2}$/.test(countryCode) && countryCode !== 'XX'
    ? countryCode
    : null
}

export function visitorCountryCodeFromHeaders(headers: Headers): string | null {
  return normalizeCountryCode(headers.get('x-vercel-ip-country'))
    || normalizeCountryCode(headers.get('cf-ipcountry'))
}

export function offerMatchesVisitorCountry(
  offer: Pick<IncentiveWidgetOffer, 'country' | 'countries'>,
  visitorCountryCode: string | null,
): boolean {
  const countryCode = normalizeCountryCode(visitorCountryCode)
  if (!countryCode) return true

  const targets = offer.countries?.length ? offer.countries : [offer.country]
  return targets.some((target) => {
    const geo = target.trim().toUpperCase()
    return !geo || GLOBAL_GEO_CODES.has(geo) || geo === countryCode
  })
}
