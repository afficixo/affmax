import { offerMatchesVisitorCountry } from './offer-geo'

const MAX_SMARTLINK_OFFERS = 1000
const MAX_SMARTLINK_OFFER_ID_LENGTH = 128
const MAX_SMARTLINK_SUBID_VALUE = 0xFFFFF

export const SMARTLINK_OFFERS_CONFIG_ID = 'smartlink-active-offers'
export const SMARTLINK_OFFERS_CONFIG_KIND = 'smartlink-offers'
export const PUBLISHER_SMARTLINK_KIND = 'publisher-smartlink'

export function publisherSmartlinkTrackingCode(id: string) {
  return id.slice(0, 8).toLowerCase()
}

export function isPublisherSmartlinkSubId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9A-F]{5}$/.test(value)
}

export function formatSmartlinkSubId(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > MAX_SMARTLINK_SUBID_VALUE) {
    throw new RangeError('Smartlink SubID must fit in five hexadecimal digits')
  }
  return value.toString(16).toUpperCase().padStart(5, '0')
}

export type SmartlinkAvailableOffer = {
  country: string
  countries?: string[]
  url: string
}

export type SmartlinkRoutableOffer = SmartlinkAvailableOffer & {
  id: string
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

export function smartlinkOffersForCountry<T extends SmartlinkAvailableOffer>(
  offers: T[],
  countryCode: string | null,
): T[] {
  const matchingOffers = offers.filter((offer) => offerMatchesVisitorCountry(offer, countryCode))
  return matchingOffers.length ? matchingOffers : offers
}

export function selectSmartlinkOfferForVisitor(
  offers: SmartlinkRoutableOffer[],
  countryCode: string | null,
  seenOfferIds: string[],
  randomIndex: (max: number) => number,
): { offer: SmartlinkRoutableOffer; seenOfferIds: string[] } | null {
  const candidates = countryCode
    ? offers.filter((offer) => offerMatchesVisitorCountry(offer, countryCode))
    : []
  if (!candidates.length) return null

  const candidateIds = new Set(candidates.map((offer) => offer.id))
  const seenCandidates = seenOfferIds.filter((id) => candidateIds.has(id))
  const seen = new Set(seenCandidates)
  const unseenCandidates = candidates.filter((offer) => !seen.has(offer.id))
  const startingNewCycle = unseenCandidates.length === 0
  const pool = startingNewCycle ? candidates : unseenCandidates
  const offer = pool[randomIndex(pool.length)]
  if (!offer) return null

  return {
    offer,
    seenOfferIds: startingNewCycle ? [offer.id] : [...seenCandidates, offer.id],
  }
}
