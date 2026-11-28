import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildOfferClickDuplicateWhere } from '../src/lib/offer-click-dedupe'

const windowStart = new Date('2026-11-28T00:00:00.000Z')

test('deduplicates a Smartlink visitor across its different offers', () => {
  assert.deepEqual(
    buildOfferClickDuplicateWhere({
      publisherNumber: 60001,
      offerId: 'offer-current',
      smartlinkId: 'smartlink-1',
      ipAddress: '203.0.113.10',
      userAgent: 'Example Browser',
      windowStart,
    }),
    {
      publisherNumber: 60001,
      smartlinkId: 'smartlink-1',
      ipAddress: '203.0.113.10',
      userAgent: 'Example Browser',
      createdAt: { gte: windowStart },
    },
  )
})

test('does not deduplicate Smartlink clicks without both visitor identifiers', () => {
  assert.equal(
    buildOfferClickDuplicateWhere({
      publisherNumber: 60001,
      offerId: 'offer-1',
      smartlinkId: 'smartlink-1',
      ipAddress: '203.0.113.10',
      userAgent: null,
      windowStart,
    }),
    null,
  )
})

test('keeps ordinary offer-click deduplication scoped to non-Smartlink clicks', () => {
  assert.deepEqual(
    buildOfferClickDuplicateWhere({
      publisherNumber: 60001,
      offerId: 'offer-1',
      ipAddress: '203.0.113.10',
      userAgent: 'Example Browser',
      windowStart,
    }),
    {
      publisherNumber: 60001,
      offerId: 'offer-1',
      smartlinkId: null,
      createdAt: { gte: windowStart },
      OR: [{ ipAddress: '203.0.113.10' }, { userAgent: 'Example Browser' }],
    },
  )
})
