import { NextResponse } from 'next/server'
import { getCorsHeaders } from '@/config/cors'
import { getTokenFromCookie, getUserFromToken } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { normalizeSmartlinkOfferIds } from '@/lib/smartlink'

const SMARTLINK_OFFERS_CONFIG_ID = 'smartlink-active-offers'
const SMARTLINK_OFFERS_CONFIG_KIND = 'smartlink-offers'

async function requireManager(request: Request) {
  const origin = request.headers.get('origin') || null
  const token = getTokenFromCookie(request.headers.get('cookie') || '')
  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders(origin) }) }
  }

  const user = await getUserFromToken(token)
  if (!user || user.role !== 'MANAGER') {
    return { error: NextResponse.json({ error: 'Only managers can manage Smartlink offers' }, { status: 403, headers: getCorsHeaders(origin) }) }
  }
  return { user, origin }
}

export async function GET(request: Request) {
  const auth = await requireManager(request)
  if ('error' in auth) return auth.error

  try {
    const config = await prisma.incentiveTool.findUnique({
      where: { id: SMARTLINK_OFFERS_CONFIG_ID },
      select: { kind: true, selectedOfferIds: true },
    })
    if (config && config.kind !== SMARTLINK_OFFERS_CONFIG_KIND) {
      return NextResponse.json({ error: 'Smartlink offer settings are unavailable' }, { status: 409, headers: getCorsHeaders(auth.origin) })
    }

    return NextResponse.json(
      { offerIds: config?.selectedOfferIds ?? [] },
      { headers: { ...getCorsHeaders(auth.origin), 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('Load Smartlink offers failed:', error)
    return NextResponse.json(
      { error: 'Unable to load Smartlink offers' },
      { status: 503, headers: getCorsHeaders(auth.origin) },
    )
  }
}

export async function PUT(request: Request) {
  const auth = await requireManager(request)
  if ('error' in auth) return auth.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'A valid offer ID list is required' },
      { status: 400, headers: getCorsHeaders(auth.origin) },
    )
  }

  const offerIds = body && typeof body === 'object'
    ? normalizeSmartlinkOfferIds((body as { offerIds?: unknown }).offerIds)
    : null
  if (!offerIds) {
    return NextResponse.json(
      { error: 'Offer IDs must be a list of up to 1000 valid IDs' },
      { status: 400, headers: getCorsHeaders(auth.origin) },
    )
  }

  try {
    const existing = await prisma.incentiveTool.findUnique({
      where: { id: SMARTLINK_OFFERS_CONFIG_ID },
      select: { kind: true },
    })
    if (existing && existing.kind !== SMARTLINK_OFFERS_CONFIG_KIND) {
      return NextResponse.json({ error: 'Smartlink offer settings are unavailable' }, { status: 409, headers: getCorsHeaders(auth.origin) })
    }

    await prisma.incentiveTool.upsert({
      where: { id: SMARTLINK_OFFERS_CONFIG_ID },
      create: {
        id: SMARTLINK_OFFERS_CONFIG_ID,
        kind: SMARTLINK_OFFERS_CONFIG_KIND,
        name: 'Smartlink offer activation',
        fields: {},
        toggles: {},
        selectedOfferIds: offerIds,
        isPublished: false,
        ownerId: auth.user.id,
      },
      update: { selectedOfferIds: offerIds },
    })

    return NextResponse.json(
      { offerIds },
      { headers: { ...getCorsHeaders(auth.origin), 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('Save Smartlink offers failed:', error)
    return NextResponse.json(
      { error: 'Unable to save Smartlink offers' },
      { status: 503, headers: getCorsHeaders(auth.origin) },
    )
  }
}
