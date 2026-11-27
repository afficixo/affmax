import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  offerGeoCountryCode,
  offerMatchesVisitorCountry,
  visitorCountryCodeFromHeaders,
} from '../src/lib/offer-geo'

test('uses the offer target GEO instead of an unrelated lead country', () => {
  const leadCountry = 'CA'
  const offerGeo = offerGeoCountryCode({ country: 'GLOBAL', countries: ['US'] })

  assert.equal(offerGeo, 'US')
  assert.notEqual(offerGeo, leadCountry)
})

test('falls back to the offer country when no target country code is available', () => {
  assert.equal(offerGeoCountryCode({ country: 'US', countries: ['GLOBAL'] }), 'US')
})

test('does not convert a global offer into a visitor country', () => {
  assert.equal(offerGeoCountryCode({ country: 'GLOBAL', countries: ['GLOBAL'] }), null)
})

test('matches offers against any of their configured countries', () => {
  const offer = { country: 'US', countries: ['US', 'JP'] }

  assert.equal(offerMatchesVisitorCountry(offer, 'jp'), true)
  assert.equal(offerMatchesVisitorCountry(offer, 'CA'), false)
})

test('keeps global offers and does not geo-filter when visitor location is unknown', () => {
  assert.equal(offerMatchesVisitorCountry({ country: 'Global' }, 'CA'), true)
  assert.equal(offerMatchesVisitorCountry({ country: 'JP' }, null), true)
  assert.equal(offerMatchesVisitorCountry({ country: '' }, 'CA'), true)
})

test('reads valid visitor country codes from platform geo headers', () => {
  assert.equal(visitorCountryCodeFromHeaders(new Headers({
    'x-vercel-ip-country': 'jp',
    'cf-ipcountry': 'CA',
  })), 'JP')
  assert.equal(visitorCountryCodeFromHeaders(new Headers({ 'cf-ipcountry': 'CA' })), 'CA')
  assert.equal(visitorCountryCodeFromHeaders(new Headers({ 'cf-ipcountry': 'XX' })), null)
})
