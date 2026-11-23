import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildMarketplacePostbackUrl } from '../src/lib/marketplace-postback'

test('builds a marketplace URL with its supplied macro tokens', () => {
  const url = buildMarketplacePostbackUrl('https://crackbounty.example', 'app-secret', {
    s1: '#S1#',
    s2: '#OFFER_ID#',
    s3: '{SUB1}',
    s4: '{SUB2}',
    ip: '{IP}',
  })

  assert.equal(
    url,
    'https://crackbounty.example/api/postback/in/app-secret'
      + '?s1=#S1#&s2=#OFFER_ID#&s3={SUB1}&s4={SUB2}'
      + '&ip={IP}',
  )
})

test('keeps the existing marketplace token defaults for saved configs', () => {
  assert.equal(
    buildMarketplacePostbackUrl('https://crackbounty.example', 'app-secret'),
    'https://crackbounty.example/api/postback/in/app-secret'
      + '?s1=#s1#&s2=#s2#&s3=#s3#&s4=#s4#'
      + '&ip=#ip#',
  )
})
