import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generateCampaignOfferIds, normalizeCampaignOfferIds } from '../src/lib/campaign-offers'

test('normalizes a non-empty bulk offer ID list and removes duplicates', () => {
  assert.deepEqual(normalizeCampaignOfferIds([' 12 ', '12', '13']), ['12', '13'])
  assert.equal(normalizeCampaignOfferIds([]), null)
  assert.equal(normalizeCampaignOfferIds(['12', '']), null)
  assert.equal(normalizeCampaignOfferIds(['12', 13]), null)
})

test('generates the next unique internal offer IDs and skips reserved network IDs', () => {
  assert.deepEqual(
    generateCampaignOfferIds(['1', '7', 'GLOBAL'], 3, ['8', '10']),
    ['26401', '26402', '26403'],
  )
  assert.deepEqual(
    generateCampaignOfferIds(['26401'], 3, ['26402']),
    ['26403', '26404', '26405'],
  )
})

test('generates offer IDs without losing precision for large catalog IDs', () => {
  assert.deepEqual(
    generateCampaignOfferIds(['9007199254740991'], 2),
    ['9007199254740992', '9007199254740993'],
  )
})
