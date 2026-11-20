import { isIP } from 'node:net'

const IP2LOCATION_ENDPOINT = 'https://api.ip2location.io/'
const LOOKUP_TIMEOUT_MS = 2500
const MAX_API_KEYS = 20

let nextApiKeyIndex = 0

function getApiKeys() {
  return (process.env.IP2LOCATION_API_KEYS || '')
    .split(/[,\r\n]+/)
    .map((key) => key.trim())
    .filter(Boolean)
    .slice(0, MAX_API_KEYS)
}

function nextApiKey(keys: string[]) {
  if (!keys.length) return null
  const key = keys[nextApiKeyIndex % keys.length]
  nextApiKeyIndex = (nextApiKeyIndex + 1) % keys.length
  return key
}

function isPublicIpv4(ip: string) {
  const [first, second, third] = ip.split('.').map(Number)
  return !(
    first === 0
    || first === 10
    || first === 127
    || (first === 100 && second >= 64 && second <= 127)
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && (second === 168 || (second === 0 && (third === 0 || third === 2))))
    || (first === 198 && (second === 18 || second === 19 || (second === 51 && third === 100)))
    || (first === 203 && second === 0 && third === 113)
    || first >= 224
  )
}

function isPublicIp(ip: string) {
  const version = isIP(ip)
  if (version === 4) return isPublicIpv4(ip)
  if (version !== 6) return false

  const normalized = ip.toLowerCase()
  if (normalized.startsWith('::ffff:')) {
    const mappedIpv4 = normalized.slice('::ffff:'.length)
    if (isIP(mappedIpv4) === 4) return isPublicIpv4(mappedIpv4)
  }
  if (
    normalized === '::'
    || normalized === '::1'
    || /^(fc|fd|fe[89ab]|ff)/.test(normalized)
    || normalized.startsWith('2001:db8:')
  ) {
    return false
  }

  const firstGroup = Number.parseInt(normalized.split(':', 1)[0], 16)
  return firstGroup >= 0x2000 && firstGroup <= 0x3fff
}

export async function lookupCountryCode(
  ipAddress: string | null | undefined,
  options: { useProviderIpFallback?: boolean } = {},
): Promise<string | null> {
  const ip = ipAddress?.trim()
  const hasPublicIp = Boolean(ip && isPublicIp(ip))
  if (!hasPublicIp && !options.useProviderIpFallback) return null

  const apiKey = nextApiKey(getApiKeys())
  const headers = new Headers({ Accept: 'application/json' })
  if (apiKey) headers.set('Authorization', `Bearer ${apiKey}`)

  const url = new URL(IP2LOCATION_ENDPOINT)
  if (hasPublicIp && ip) url.searchParams.set('ip', ip)

  try {
    const response = await fetch(url, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    })
    if (!response.ok) {
      console.error(`IP2Location lookup failed with HTTP ${response.status}`)
      return null
    }

    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null || !('country_code' in result)) {
      console.error('IP2Location returned a response without a country code')
      return null
    }

    const countryCode = result.country_code
    if (typeof countryCode !== 'string' || !/^[A-Z]{2}$/i.test(countryCode)) {
      console.error('IP2Location returned an invalid country code')
      return null
    }
    return countryCode.toUpperCase()
  } catch (error) {
    console.error('IP2Location lookup failed:', error)
    return null
  }
}
