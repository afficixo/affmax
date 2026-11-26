import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildMarketplacePostbackUrl } from '../src/lib/marketplace-postback'
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
