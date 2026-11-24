import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  offerMatchesVisitorCountry,
  visitorCountryCodeFromHeaders,
} from '../src/lib/offer-geo'

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
