import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildMainOfferUrl,
  buildPublicTrackingUrl,
  decodeTrackingId,
  encodeTrackingId,
  isHexTrackingId,
} from '../src/lib/tracking'

test('encodes decimal tracking IDs as prefixed hexadecimal and decodes them', () => {
  const publisherId = encodeTrackingId(60001, 'P')
  const offerId = encodeTrackingId('35677', 'O')

  assert.equal(publisherId, 'PEA61')
  assert.equal(offerId, 'O8B5D')
  assert.equal(decodeTrackingId(publisherId, 'P'), '60001')
  assert.equal(decodeTrackingId(offerId, 'O'), '35677')
  assert.equal(isHexTrackingId(publisherId, 'P'), true)
})

test('builds hexadecimal tracking URLs while preserving Sub IDs', () => {
  const url = buildPublicTrackingUrl({
    publisherId: 60001,
    offerId: '35677',
    subId1: 'source',
    subId2: 'slot-2',
    subId3: 'slot-3',
  }, 'https://tracking.example')

  assert.equal(
    url,
    'https://tracking.example/PEA61/O8B5D?s1=source&s2=slot-2&s3=slot-3',
  )
})

test('maps publisher IDs and all three publisher sub IDs to marketplace parameters', () => {
  const url = new URL(buildMainOfferUrl({
    mainOfferBase: 'https://network.example/campaign',
    publisherId: 60001,
    subId1: 'source',
    subId2: 'slot-2',
    subId3: 'slot-3',
  }))

  assert.equal(url.searchParams.get('s1'), '60001')
  assert.equal(url.searchParams.get('s2'), 'source')
  assert.equal(url.searchParams.get('s3'), 'slot-2')
  assert.equal(url.searchParams.get('s4'), 'slot-3')
})

test('preserves existing network query parameters when adding tracking Sub IDs', () => {
  const url = new URL(buildMainOfferUrl({
    mainOfferBase: 'https://trk2affm.com/c/?p=55632&o=4380&source=network',
    publisherId: 60001,
    subId1: 'source',
    subId2: 'slot-2',
    subId3: 'slot-3',
  }))

  assert.equal(url.searchParams.get('p'), '55632')
  assert.equal(url.searchParams.get('o'), '4380')
  assert.equal(url.searchParams.get('source'), 'network')
  assert.equal(url.searchParams.get('s1'), '60001')
  assert.equal(url.searchParams.get('s2'), 'source')
  assert.equal(url.searchParams.get('s3'), 'slot-2')
  assert.equal(url.searchParams.get('s4'), 'slot-3')
})

test('keeps legacy decimal tracking IDs unchanged', () => {
  assert.equal(decodeTrackingId('60001', 'P'), '60001')
  assert.equal(decodeTrackingId('35677', 'O'), '35677')
  assert.equal(decodeTrackingId('0xea61', 'P'), '60001')
  assert.equal(decodeTrackingId('0x8b5d', 'O'), '35677')
  assert.equal(isHexTrackingId('60001', 'P'), false)
})
