import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  formatSmartlinkSubId,
  isPublisherSmartlinkSubId,
  normalizeSmartlinkOfferIds,
  selectSmartlinkOfferForVisitor,
  smartlinkOffersForCountry,
} from '../src/lib/smartlink'

const offers = [
  { country: 'US', countries: ['US'], url: 'https://us.example/1' },
  { country: 'GLOBAL', countries: ['GLOBAL'], url: 'https://global.example/1' },
  { country: 'CA', countries: ['CA'], url: 'https://ca.example/1' },
]

test('prefers visitor-country offers and global offers for an auto-routed geo', () => {
  assert.deepEqual(
    smartlinkOffersForCountry(offers, 'US').map((offer) => offer.url),
    ['https://us.example/1', 'https://global.example/1'],
  )
})

test('falls back to any active site offer when no offer matches the visitor geo', () => {
  const countryOnlyOffers = [offers[0], offers[2]]
  assert.deepEqual(
    smartlinkOffersForCountry(countryOnlyOffers, 'GB').map((offer) => offer.url),
    countryOnlyOffers.map((offer) => offer.url),
  )
})

test('uses all active site offers when the visitor country is unknown', () => {
  assert.deepEqual(
    smartlinkOffersForCountry(offers, null).map((offer) => offer.url),
    offers.map((offer) => offer.url),
  )
})

test('does not route publisher Smartlinks when the visitor country is unknown', () => {
  const routableOffers = offers.map((offer, index) => ({ ...offer, id: `offer-${index}` }))
  assert.equal(
    selectSmartlinkOfferForVisitor(routableOffers, null, [], () => assert.fail('must not select an offer')),
    null,
  )
})

test('does not route publisher Smartlinks to another country when there is no geo match', () => {
  const countryOffers = [offers[0], offers[2]].map((offer, index) => ({ ...offer, id: `offer-${index}` }))
  assert.equal(
    selectSmartlinkOfferForVisitor(countryOffers, 'GB', [], () => assert.fail('must not select an offer')),
    null,
  )
})

test('returns no candidates when the site has no available offers', () => {
  assert.deepEqual(smartlinkOffersForCountry([], 'US'), [])
})

test('formats Smartlink SubID 1 as a five-character uppercase hexadecimal value', () => {
  assert.equal(formatSmartlinkSubId(0), '00000')
  assert.equal(formatSmartlinkSubId(0xABCDE), 'ABCDE')
  assert.equal(formatSmartlinkSubId(0xFFFFF), 'FFFFF')
  assert.equal(isPublisherSmartlinkSubId('ABCDE'), true)
  assert.equal(isPublisherSmartlinkSubId('ABCD'), false)
  assert.equal(isPublisherSmartlinkSubId('ABCDE0'), false)
  assert.equal(isPublisherSmartlinkSubId('abcde'), false)
  assert.throws(() => formatSmartlinkSubId(0x100000), RangeError)
})

test('selects an unseen eligible offer before repeating a geo-eligible offer', () => {
  const routableOffers = offers.map((offer, index) => ({ ...offer, id: `offer-${index}` }))
  const selection = selectSmartlinkOfferForVisitor(
    routableOffers,
    'US',
    ['offer-0'],
    (max) => {
      assert.equal(max, 1)
      return 0
    },
  )

  assert.equal(selection?.offer.id, 'offer-1')
  assert.deepEqual(selection?.seenOfferIds, ['offer-0', 'offer-1'])
})

test('starts a new random cycle after all eligible offers have been seen', () => {
  const routableOffers = offers.map((offer, index) => ({ ...offer, id: `offer-${index}` }))
  const selection = selectSmartlinkOfferForVisitor(
    routableOffers,
    'US',
    ['offer-0', 'offer-1', 'offer-2'],
    (max) => {
      assert.equal(max, 2)
      return 1
    },
  )

  assert.equal(selection?.offer.id, 'offer-1')
  assert.deepEqual(selection?.seenOfferIds, ['offer-1'])
})

test('normalizes and deduplicates selected Smartlink offer IDs', () => {
  assert.deepEqual(normalizeSmartlinkOfferIds(['  101 ', '101', 'offer-2']), ['101', 'offer-2'])
})

test('rejects invalid Smartlink offer ID lists', () => {
  assert.equal(normalizeSmartlinkOfferIds(['']), null)
  assert.equal(normalizeSmartlinkOfferIds(['x'.repeat(129)]), null)
  assert.equal(normalizeSmartlinkOfferIds([1]), null)
  assert.equal(normalizeSmartlinkOfferIds(Array.from({ length: 1001 }, (_, index) => String(index))), null)
})
