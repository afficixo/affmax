import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildMarketplacePostbackUrl,
  mapPublisherSubIds,
} from '../src/lib/marketplace-postback'
import { hasRequiredMarketplacePostbackTokens } from '../src/lib/postback-tokens'

test('builds a marketplace URL with its supplied macro tokens', () => {
  const url = buildMarketplacePostbackUrl('https://crackbounty.example', 'app-secret', {
    s1: '#S1#',
    s2: '#S2#',
    s3: '#S3#',
    s4: '#S4#',
    cmpid: '#CMPID#',
    ip: '{IP}',
  })

  assert.equal(
    url,
    'https://crackbounty.example/api/postback/in/app-secret'
      + '?s1=#S1#&s2=#S2#&s3=#S3#&s4=#S4#'
    + '&ip={IP}&cmpid=#CMPID#',
  )
})

test('requires publisher and marketplace offer ID tokens but allows empty publisher subs', () => {
  assert.equal(hasRequiredMarketplacePostbackTokens({
    s1: '#S1#',
    s2: '',
    s3: '',
    s4: '',
    cmpid: '#CMPID#',
    ip: '',
  }), true)
  assert.equal(hasRequiredMarketplacePostbackTokens({
    s1: ' ',
    s2: '#S2#',
    s3: '',
    s4: '',
    cmpid: '#CMPID#',
    ip: '',
  }), false)
  assert.equal(hasRequiredMarketplacePostbackTokens({
    s1: '#S1#',
    s2: '',
    s3: '',
    s4: '',
    cmpid: '',
    ip: '',
  }), false)
})

test('keeps the existing marketplace token defaults for saved configs', () => {
  assert.equal(
    buildMarketplacePostbackUrl('https://crackbounty.example', 'app-secret'),
    'https://crackbounty.example/api/postback/in/app-secret'
      + '?s1=#s1#&s2=#s2#&s3=#s3#&s4=#s4#'
      + '&ip=#ip#&cmpid=#cmpid#',
  )
})

test('maps Smartlink publisher SubID1 from s2 when the offer ID is separate', () => {
  assert.deepEqual(mapPublisherSubIds({
    hasSeparateOfferId: true,
    s2: '5FF8F',
    s3: 'partner-slot',
    s4: 'placement',
  }), {
    sub1: '5FF8F',
    sub2: 'partner-slot',
    sub3: 'placement',
  })
})

test('preserves legacy SubID positions when the offer ID is in s2', () => {
  assert.deepEqual(mapPublisherSubIds({
    hasSeparateOfferId: false,
    s2: 'O8B5D',
    s3: '5FF8F',
    s4: 'partner-slot',
  }), {
    sub1: '5FF8F',
    sub2: 'partner-slot',
    sub3: '',
  })
})
