import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getCorsHeaders } from '@/config/cors'
import { getTokenFromCookie, getUserFromToken } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'

const SMARTLINK_GROUP_KIND = 'smartlink'
const MAX_GROUP_NAME_LENGTH = 80
const MAX_GROUP_OFFERS = 1000
const MAX_GEO_RULES = 100

type SmartlinkGeoRule = {
  countryCode: string
  offers: Array<{ id: string; url: string }>
}

function normalizeHttpUrl(value: unknown) {
  if (typeof value !== 'string' || value.length > 2048) return null
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function normalizeGeoRules(value: unknown): SmartlinkGeoRule[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_GEO_RULES) return null
  const seenCountries = new Set<string>()
  let totalOffers = 0
  const geoRules: SmartlinkGeoRule[] = []

  for (const candidate of value) {
    if (!candidate || typeof candidate !== 'object') return null
    const rule = candidate as { countryCode?: unknown; offers?: unknown }
    const countryCode = typeof rule.countryCode === 'string' ? rule.countryCode.trim().toUpperCase() : ''
    if (!/^[A-Z]{2}$/.test(countryCode) || seenCountries.has(countryCode) || !Array.isArray(rule.offers)) {
      return null
    }

    const offers: SmartlinkGeoRule['offers'] = []
    const seenOfferIds = new Set<string>()
    for (const item of rule.offers) {
      if (!item || typeof item !== 'object') return null
      const offer = item as { id?: unknown; url?: unknown }
      const id = typeof offer.id === 'string' ? offer.id.trim() : ''
      const url = normalizeHttpUrl(offer.url)
      if (!id || id.length > 128 || !url || seenOfferIds.has(id)) return null
      seenOfferIds.add(id)
      offers.push({ id, url })
    }

    totalOffers += offers.length
    if (totalOffers > MAX_GROUP_OFFERS) return null
    seenCountries.add(countryCode)
    geoRules.push({ countryCode, offers })
  }

  return geoRules
}

async function requireManager(request: Request) {
  const origin = request.headers.get('origin') || null
  const token = getTokenFromCookie(request.headers.get('cookie') || '')
  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders(origin) }) }
  }

  const user = await getUserFromToken(token)
  if (!user || user.role !== 'MANAGER') {
    return { error: NextResponse.json({ error: 'Only managers can manage Smartlink groups' }, { status: 403, headers: getCorsHeaders(origin) }) }
  }
  return { user, origin }
}

export async function GET(request: Request) {
  const auth = await requireManager(request)
  if ('error' in auth) return auth.error

  try {
    const groups = await prisma.incentiveTool.findMany({
      where: { ownerId: auth.user.id, kind: SMARTLINK_GROUP_KIND },
      select: { id: true, name: true, selectedOfferIds: true, fields: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ groups }, { headers: getCorsHeaders(auth.origin) })
  } catch (error) {
    console.error('List Smartlink groups failed:', error)
    return NextResponse.json(
      { error: 'Unable to load Smartlink groups' },
      { status: 503, headers: getCorsHeaders(auth.origin) },
    )
  }
}

export async function POST(request: Request) {
  const auth = await requireManager(request)
  if ('error' in auth) return auth.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'A valid group name and geo rules are required' },
      { status: 400, headers: getCorsHeaders(auth.origin) },
    )
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json(
      { error: 'A valid group name and geo rules are required' },
      { status: 400, headers: getCorsHeaders(auth.origin) },
    )
  }

  const payload = body as { name?: unknown; geoRules?: unknown }
  const name = typeof payload.name === 'string' ? payload.name.trim() : ''
  const geoRules = normalizeGeoRules(payload.geoRules)
  const selectedOfferIds = [...new Set(geoRules?.flatMap((rule) => rule.offers.map((offer) => offer.id)) ?? [])]

  if (
    !name
    || name.length > MAX_GROUP_NAME_LENGTH
    || !geoRules
  ) {
    return NextResponse.json(
      { error: `Enter a group name (up to ${MAX_GROUP_NAME_LENGTH} characters) and valid geo rules` },
      { status: 400, headers: getCorsHeaders(auth.origin) },
    )
  }

  try {
    const group = await prisma.incentiveTool.create({
      data: {
        id: randomUUID(),
        kind: SMARTLINK_GROUP_KIND,
        name,
        fields: { geoRules },
        toggles: {},
        selectedOfferIds,
        isPublished: false,
        ownerId: auth.user.id,
      },
      select: { id: true, name: true, selectedOfferIds: true, fields: true, createdAt: true },
    })
    return NextResponse.json({ group }, { status: 201, headers: getCorsHeaders(auth.origin) })
  } catch (error) {
    console.error('Create Smartlink group failed:', error)
    return NextResponse.json(
      { error: 'Unable to create Smartlink group' },
      { status: 503, headers: getCorsHeaders(auth.origin) },
    )
  }
}
