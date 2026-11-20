import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lookupCountryCode } from '../src/lib/ip2location'

test('skips private IPs and rotates API keys for public IP lookups', async () => {
  const originalFetch = globalThis.fetch
  const originalApiKeys = process.env.IP2LOCATION_API_KEYS
  const requests: Array<{ url: URL; authorization: string | null }> = []
  process.env.IP2LOCATION_API_KEYS = 'first-key, second-key'
  globalThis.fetch = async (input, init) => {
    requests.push({
      url: new URL(String(input)),
      authorization: new Headers(init?.headers).get('authorization'),
    })
    return Response.json({ country_code: 'BD' })
  }

  try {
    assert.equal(await lookupCountryCode('127.0.0.1'), null)
    assert.equal(await lookupCountryCode('103.109.238.234'), 'BD')
    assert.equal(await lookupCountryCode('8.8.8.8'), 'BD')
    assert.equal(await lookupCountryCode('127.0.0.1', { useProviderIpFallback: true }), 'BD')
    assert.equal(requests.length, 3)
    assert.deepEqual(requests.map((request) => request.authorization), [
      'Bearer first-key',
      'Bearer second-key',
      'Bearer first-key',
    ])
    assert.equal(requests[0].url.searchParams.get('ip'), '103.109.238.234')
    assert.equal(requests[2].url.searchParams.has('ip'), false)
  } finally {
    globalThis.fetch = originalFetch
    if (originalApiKeys === undefined) delete process.env.IP2LOCATION_API_KEYS
    else process.env.IP2LOCATION_API_KEYS = originalApiKeys
  }
})
