import { offerMatchesVisitorCountry } from './offer-geo'

const MAX_SMARTLINK_OFFERS = 1000
const MAX_SMARTLINK_OFFER_ID_LENGTH = 128

export type SmartlinkAvailableOffer = {
  country: string
  countries?: string[]
  url: string
}

export function normalizeSmartlinkOfferIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_SMARTLINK_OFFERS) return null

  const offerIds: string[] = []
  const seen = new Set<string>()
  for (const candidate of value) {
    if (typeof candidate !== 'string') return null
    const id = candidate.trim()
    if (!id || id.length > MAX_SMARTLINK_OFFER_ID_LENGTH) return null
    if (!seen.has(id)) {
      seen.add(id)
      offerIds.push(id)
    }
  }
  return offerIds
}

export function smartlinkOffersForCountry(
  offers: SmartlinkAvailableOffer[],
  countryCode: string | null,
): SmartlinkAvailableOffer[] {
  const matchingOffers = offers.filter((offer) => offerMatchesVisitorCountry(offer, countryCode))
  return matchingOffers.length ? matchingOffers : offers
}
