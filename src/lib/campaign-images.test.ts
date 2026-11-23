import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getCrackBountyImageUrl,
  getCampaignImageProxyPath,
  isCampaignImageProxyPath,
  toCampaignImageSource,
} from './campaign-images'

test('proxies supported Crack Bounty preview images without exposing the source URL', () => {
  const imageSource = 'https://crackbounty.afficix.com/preview/35677.png'

  assert.equal(getCrackBountyImageUrl(imageSource), imageSource)
  assert.equal(toCampaignImageSource('35677', imageSource), '/api/campaigns/35677/image')
})

test('does not proxy URLs outside the supported image host and paths', () => {
  const imageSources = [
    'https://example.com/image.png',
    'http://crackbounty.afficix.com/preview/35677.png',
    'https://crackbounty.afficix.com/preview/35677.png?token=secret',
    'https://crackbounty.afficix.com/preview/35677.svg',
  ]

  for (const imageSource of imageSources) {
    assert.equal(getCrackBountyImageUrl(imageSource), null)
    assert.equal(toCampaignImageSource('35677', imageSource), imageSource)
  }
})

test('recognizes only the matching campaign image proxy path', () => {
  const imagePath = getCampaignImageProxyPath('35677')

  assert.equal(isCampaignImageProxyPath(imagePath, '35677'), true)
  assert.equal(isCampaignImageProxyPath(imagePath, '12345'), false)
})
