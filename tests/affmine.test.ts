import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getAffmineSourceOfferId, parseAffmineOffers } from '../src/lib/affmine'

test('reads the original Affmine offer ID from its preserved tracking URL', () => {
  assert.equal(
    getAffmineSourceOfferId('https://trk2affm.com/c/?p=55632&o=4380'),
    '4380',
  )
  assert.equal(getAffmineSourceOfferId('https://network.example/click?id=4380'), null)
  assert.equal(getAffmineSourceOfferId('not-a-url'), null)
})

test('parses Affmine offers and normalizes country codes and URLs', () => {
  const offers = parseAffmineOffers(`
    <response>
      <offers>
        <offer>
          <offer_id>12345</offer_id>
          <offer_name>Sample &amp; App</offer_name>
          <payout>2.75</payout>
          <currency>USD</currency>
          <preview>https://cdn.example/offer.png</preview>
          <url>https://tracking.example/click?id=12345</url>
          <category>App Install</category>
          <country><country_code>us</country_code></country>
          <country><country_code>gb</country_code></country>
          <description>Install the app</description>
          <incentive>yes</incentive>
        </offer>
      </offers>
    </response>
  `)

  assert.deepEqual(offers, [{
    id: '12345',
    name: 'Sample & App',
    payout: 2.75,
    currency: 'USD',
    previewUrl: 'https://cdn.example/offer.png',
    trackingUrl: 'https://tracking.example/click?id=12345',
    category: 'App Install',
    countries: ['US', 'GB'],
    description: 'Install the app',
    incentive: true,
  }])
})

test('parses singleton offers and supplies safe fallbacks for optional feed fields', () => {
  const offers = parseAffmineOffers(`
    <response>
      <offer>
        <id>456</id>
        <name>Lead offer</name>
        <payout>not-a-number</payout>
        <url>javascript:alert(1)</url>
        <preview>//outside.example/image.png</preview>
      </offer>
    </response>
  `)

  assert.equal(offers.length, 1)
  assert.equal(offers[0].name, 'Lead offer')
  assert.equal(offers[0].payout, null)
  assert.equal(offers[0].trackingUrl, '')
  assert.equal(offers[0].previewUrl, '')
  assert.equal(offers[0].description, 'No description available.')
  assert.deepEqual(offers[0].countries, [])

  const relativeTrackingOffer = parseAffmineOffers(
    '<response><offer><id>457</id><url>/local/tracking/457</url></offer></response>',
  )
  assert.equal(relativeTrackingOffer[0].trackingUrl, '')
})

test('parses nested country nodes and country codes in offer names', () => {
  const offers = parseAffmineOffers(`
    <response>
      <offer>
        <offer_id>789</offer_id>
        <offer_name>Sample campaign (UK)</offer_name>
        <countries>
          <country><country_code>ca</country_code></country>
          <country><country_code>us</country_code></country>
        </countries>
      </offer>
      <offer>
        <offer_id>790</offer_id>
        <offer_name>Another campaign - AU,DE</offer_name>
      </offer>
    </response>
  `)

  assert.deepEqual(offers.map((offer) => offer.countries), [['CA', 'US'], ['AU', 'DE']])
  assert.deepEqual(offers.map((offer) => offer.name), ['Sample campaign (UK)', 'Another campaign - AU,DE'])
  assert.deepEqual(offers[0].countries, ['CA', 'US'])
  assert.deepEqual(parseAffmineOffers(
    '<response><offer><id>791</id><name>UK campaign (UK)</name></offer></response>',
  )[0].countries, ['GB'])
})

test('rejects invalid XML and Affmine API error responses', () => {
  assert.throws(() => parseAffmineOffers('<response><offer></response>'), /invalid XML/i)
  assert.throws(
    () => parseAffmineOffers('<response><error_id>401</error_id><error_message>Denied</error_message></response>'),
    /rejected the request/i,
  )
})
