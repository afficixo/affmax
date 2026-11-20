import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getAffmineImageUrl,
  getCampaignImageProxyPath,
  isCampaignImageProxyPath,
  toCampaignImageSource,
} from './campaign-images'

test('proxies supported Affmine preview images without exposing the source URL', () => {
  const imageSource = 'https://network.affmine.com/preview/35677.png'

  assert.equal(getAffmineImageUrl(imageSource), imageSource)
  assert.equal(toCampaignImageSource('35677', imageSource), '/api/campaigns/35677/image')
})

test('does not proxy URLs outside the supported image host and paths', () => {
  const imageSources = [
    'https://example.com/image.png',
    'http://network.affmine.com/preview/35677.png',
    'https://network.affmine.com/preview/35677.png?token=secret',
    'https://network.affmine.com/preview/35677.svg',
  ]

  for (const imageSource of imageSources) {
    assert.equal(getAffmineImageUrl(imageSource), null)
    assert.equal(toCampaignImageSource('35677', imageSource), imageSource)
  }
})

test('recognizes only the matching campaign image proxy path', () => {
  const imagePath = getCampaignImageProxyPath('35677')

  assert.equal(isCampaignImageProxyPath(imagePath, '35677'), true)
  assert.equal(isCampaignImageProxyPath(imagePath, '12345'), false)
})
