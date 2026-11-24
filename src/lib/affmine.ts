import { XMLParser, XMLValidator } from 'fast-xml-parser'

export type AffmineOffer = {
  id: string
  name: string
  payout: number | null
  currency: string
  previewUrl: string
  trackingUrl: string
  category: string
  countries: string[]
  description: string
  incentive: boolean
}

export function getAffmineSourceOfferId(trackingUrl: string): string | null {
  try {
    const sourceId = new URL(trackingUrl).searchParams.get('o')?.trim()
    return sourceId && /^\d+$/.test(sourceId) ? sourceId : null
  } catch {
    return null
  }
}

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  trimValues: true,
  isArray: (tagName) => ['offer', 'country'].includes(tagName.toLowerCase()),
})

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)

function readText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim()
  if (Array.isArray(value)) return readText(value[0])
  if (!isRecord(value)) return ''
  return readText(value['#text'] ?? value._text ?? '')
}

function readField(record: Record<string, unknown>, names: string[]): string {
  const field = Object.entries(record).find(([name]) => names.includes(name.toLowerCase()))
  return field ? readText(field[1]) : ''
}

function findField(value: unknown, names: string[]): string {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findField(item, names)
      if (found) return found
    }
    return ''
  }
  if (!isRecord(value)) return ''

  for (const [name, child] of Object.entries(value)) {
    if (names.includes(name.toLowerCase())) return readText(child)
  }
  for (const child of Object.values(value)) {
    const found = findField(child, names)
    if (found) return found
  }
  return ''
}

function collectOfferRecords(value: unknown, offers: Record<string, unknown>[]): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collectOfferRecords(item, offers))
    return
  }
  if (!isRecord(value)) return

  for (const [name, child] of Object.entries(value)) {
    if (name.toLowerCase() !== 'offer') continue
    const records = Array.isArray(child) ? child : [child]
    offers.push(...records.filter(isRecord))
  }

  for (const [name, child] of Object.entries(value)) {
    if (name.toLowerCase() !== 'offer') collectOfferRecords(child, offers)
  }
}

function readCountries(record: Record<string, unknown>): string[] {
  const countries: string[] = []
  const addCountry = (value: string) => {
    const code = value.trim().toUpperCase()
    if (/^[A-Z]{2}$/.test(code)) countries.push(code === 'UK' ? 'GB' : code)
  }
  const visit = (value: unknown, insideCountry: boolean = false) => {
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, insideCountry))
      return
    }
    if (!isRecord(value)) return

    for (const [name, child] of Object.entries(value)) {
      const field = name.toLowerCase()
      if (field === 'country') {
        if (Array.isArray(child)) {
          visit(child, true)
        } else if (isRecord(child)) {
          const code = readField(child, ['country_code', 'code'])
          if (code) addCountry(code)
          visit(child, true)
        } else {
          addCountry(readText(child))
        }
      } else if (field === 'country_code' || (insideCountry && field === 'code')) {
        addCountry(readText(child))
      } else {
        visit(child, insideCountry)
      }
    }
  }
  visit(record)

  if (!countries.length) {
    const suffix = record.name ?? record.offer_name ?? record.campaign_name
    const match = readText(suffix).match(/(?:\(\s*([A-Z]{2}(?:\s*,\s*[A-Z]{2})*)\s*\)|-\s*([A-Z]{2}(?:\s*,\s*[A-Z]{2})*))\s*$/i)
    if (match) {
      for (const country of (match[1] ?? match[2]).split(',')) addCountry(country)
    }
  }

  return Array.from(new Set(countries))
}

function normalizeHttpUrl(value: string, allowRelative = false): string {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : ''
  } catch {
    return allowRelative && value.startsWith('/') && !value.startsWith('//') ? value : ''
  }
}

export function parseAffmineOffers(xml: string): AffmineOffer[] {
  const validation = XMLValidator.validate(xml)
  if (validation !== true) throw new Error('Affmine returned invalid XML.')

  const document: unknown = parser.parse(xml)
  const errorId = findField(document, ['error_id'])
  if (errorId) throw new Error('Affmine rejected the request.')

  const records: Record<string, unknown>[] = []
  collectOfferRecords(document, records)

  return records.flatMap((record) => {
    const id = readField(record, ['offer_id', 'id'])
    if (!id) return []

    const rawPayout = readField(record, ['payout', 'amount'])
    const payout = /^\d+(?:\.\d+)?$/.test(rawPayout) ? Number(rawPayout) : null
    const previewUrl = normalizeHttpUrl(readField(record, ['preview', 'image', 'thumbnail']), true)
    const trackingUrl = normalizeHttpUrl(readField(record, ['url', 'tracking_url', 'link']))

    return [{
      id,
      name: readField(record, ['offer_name', 'name', 'campaign_name']) || `Offer #${id}`,
      payout: Number.isFinite(payout) ? payout : null,
      currency: readField(record, ['currency', 'curr']).toUpperCase(),
      previewUrl,
      trackingUrl,
      category: readField(record, ['category', 'type']) || 'General',
      countries: readCountries(record),
      description: readField(record, ['description', 'desc']) || 'No description available.',
      incentive: ['yes', 'true', '1'].includes(readField(record, ['incentive']).toLowerCase()),
    }]
  })
}
