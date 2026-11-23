import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildPublisherPostbackUrl } from '../src/lib/publisher-postback'
import { isPublisherGlobalPostbackActive } from '../src/lib/postback-tokens'

test('reports a missing publisher postback URL as inactive', () => {
  assert.equal(isPublisherGlobalPostbackActive('', true), false)
  assert.equal(isPublisherGlobalPostbackActive(null, true), false)
  assert.equal(isPublisherGlobalPostbackActive('  ', null), false)
})

test('keeps a configured publisher postback active unless explicitly disabled', () => {
  assert.equal(isPublisherGlobalPostbackActive('https://publisher.example/postback', true), true)
  assert.equal(isPublisherGlobalPostbackActive('https://publisher.example/postback', null), true)
  assert.equal(isPublisherGlobalPostbackActive('https://publisher.example/postback', false), false)
})

test('builds a publisher postback with conversion fields and an explicit test marker', () => {
  const url = buildPublisherPostbackUrl(
    'https://publisher.example/postback?campaign=#cmpname#&id=#cmpid#&revenue=#payout#'
      + '&s1=#s1#&s2=#s2#&status=#status#&test=#test#',
    {
      offerId: 'offer-42',
      campaignName: 'Summer Offer',
      payout: 2,
      country: 'US',
      ipAddress: '192.0.2.1',
      status: 'pending',
      sub3: 'test-sub-1',
      sub4: 'test-sub-2',
      isTest: true,
      createdAt: new Date('2026-11-24T00:00:00.000Z'),
    },
  )

  assert.equal(
    url,
    'https://publisher.example/postback?campaign=Summer%20Offer&id=offer-42&revenue=2'
      + '&s1=test-sub-1&s2=test-sub-2&status=2&test=1',
  )
})

test('marks normal conversion postbacks as non-test', () => {
  const url = buildPublisherPostbackUrl(
    'https://publisher.example/postback?test=#test#',
    { createdAt: new Date('2026-11-24T00:00:00.000Z') },
  )

  assert.equal(url, 'https://publisher.example/postback?test=0')
})
