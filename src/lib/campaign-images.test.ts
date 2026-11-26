import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getAffmineCampaignImageUrl,
  getAffmineImageProxyPath,
  getAffminePreviewImageId,
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

test('proxies Affmine preview images through a same-site path', () => {
  const imageSource = 'https://network.affmine.com/preview/4380.jpg'

  assert.equal(getAffminePreviewImageId(imageSource), '4380')
  assert.equal(getAffmineCampaignImageUrl('4380'), imageSource)
  assert.equal(getAffmineImageProxyPath('4380'), '/api/campaign-images/4380')
  assert.equal(toCampaignImageSource('26401', imageSource), '/api/campaign-images/4380')
})

test('does not proxy URLs outside the supported image host and paths', () => {
  const imageSources = [
    'https://example.com/image.png',
    'http://crackbounty.afficix.com/preview/35677.png',
    'https://crackbounty.afficix.com/preview/35677.png?token=secret',
    'https://crackbounty.afficix.com/preview/35677.svg',
    'https://network.affmine.com/preview/4380.jpg?token=secret',
    'https://network.affmine.com.evil.example/preview/4380.jpg',
    'https://network.affmine.com/preview/4380.png',
  ]

  for (const imageSource of imageSources) {
    assert.equal(getCrackBountyImageUrl(imageSource), null)
    assert.equal(getAffminePreviewImageId(imageSource), null)
    assert.equal(toCampaignImageSource('35677', imageSource), imageSource)
  }
})

test('constructs Affmine image URLs only for numeric image IDs', () => {
  assert.equal(getAffmineCampaignImageUrl('4380'), 'https://network.affmine.com/preview/4380.jpg')
  assert.equal(getAffmineCampaignImageUrl('4380/other'), null)
})

test('recognizes only the matching campaign image proxy path', () => {
  const imagePath = getCampaignImageProxyPath('35677')

  assert.equal(isCampaignImageProxyPath(imagePath, '35677'), true)
  assert.equal(isCampaignImageProxyPath(imagePath, '12345'), false)
})
