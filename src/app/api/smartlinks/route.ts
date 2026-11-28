import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getCorsHeaders } from '@/config/cors'
import { getTokenFromCookie, getUserFromToken } from '@/lib/auth'
import {
  LEGACY_CRACK_BOUNTY_DEMO_OFFER_IDS,
} from '@/lib/campaign-offers'
import { prisma } from '@/lib/db/prisma'
import {
  PUBLISHER_SMARTLINK_KIND,
  SMARTLINK_OFFERS_CONFIG_ID,
  SMARTLINK_OFFERS_CONFIG_KIND,
} from '@/lib/smartlink'

const MAX_SMARTLINK_NAME_LENGTH = 80
const legacyOfferIds = new Set<string>(LEGACY_CRACK_BOUNTY_DEMO_OFFER_IDS)

function isHttpUrl(value: string | null) {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

async function requirePublisher(request: Request) {
  const origin = request.headers.get('origin') || null
  const token = getTokenFromCookie(request.headers.get('cookie') || '')
  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders(origin) }) }
  }

  const user = await getUserFromToken(token)
  if (!user || user.role !== 'PUBLISHER' || user.status !== 'ACTIVE') {
    return { error: NextResponse.json({ error: 'Active publisher access is required' }, { status: 403, headers: getCorsHeaders(origin) }) }
  }
  return { user, origin }
}

export async function GET(request: Request) {
  const auth = await requirePublisher(request)
  if ('error' in auth) return auth.error

  try {
    const links = await prisma.incentiveTool.findMany({
      where: {
        ownerId: auth.user.id,
        kind: PUBLISHER_SMARTLINK_KIND,
        isPublished: true,
      },
      select: { id: true, name: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ links }, {
      headers: { ...getCorsHeaders(auth.origin), 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('List publisher Smartlinks failed:', error)
    return NextResponse.json(
      { error: 'Unable to load your Smartlinks' },
      { status: 503, headers: getCorsHeaders(auth.origin) },
    )
  }
}

export async function POST(request: Request) {
  const auth = await requirePublisher(request)
  if ('error' in auth) return auth.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'A Smartlink name is required' },
      { status: 400, headers: getCorsHeaders(auth.origin) },
    )
  }

  const name = body && typeof body === 'object' && 'name' in body && typeof body.name === 'string'
    ? body.name.trim()
    : ''
  if (!name || name.length > MAX_SMARTLINK_NAME_LENGTH) {
    return NextResponse.json(
      { error: `Enter a name up to ${MAX_SMARTLINK_NAME_LENGTH} characters` },
      { status: 400, headers: getCorsHeaders(auth.origin) },
    )
  }

  try {
    const config = await prisma.incentiveTool.findUnique({
      where: { id: SMARTLINK_OFFERS_CONFIG_ID },
      select: { kind: true, selectedOfferIds: true },
    })
    if (config && config.kind !== SMARTLINK_OFFERS_CONFIG_KIND) {
      return NextResponse.json(
        { error: 'Smartlink offers are not configured correctly' },
        { status: 409, headers: getCorsHeaders(auth.origin) },
      )
    }

    const selectedOfferIds = config?.selectedOfferIds ?? []
    const offers = selectedOfferIds.length
      ? await prisma.campaignOffer.findMany({
          where: {
            id: { in: selectedOfferIds.filter((id) => !legacyOfferIds.has(id)) },
            status: 'ACTIVE',
            offerLink: { not: null },
          },
          select: { offerLink: true },
        })
      : []
    if (!offers.some((offer) => isHttpUrl(offer.offerLink))) {
      return NextResponse.json(
        { error: 'No active Smartlink offers are available yet. Ask your manager to activate offers first.' },
        { status: 409, headers: getCorsHeaders(auth.origin) },
      )
    }

    const link = await prisma.incentiveTool.create({
      data: {
        id: randomUUID(),
        kind: PUBLISHER_SMARTLINK_KIND,
        name,
        fields: {},
        toggles: {},
        selectedOfferIds: [],
        isPublished: true,
        ownerId: auth.user.id,
      },
      select: { id: true, name: true, createdAt: true },
    })
    return NextResponse.json({ link }, {
      status: 201,
      headers: { ...getCorsHeaders(auth.origin), 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('Create publisher Smartlink failed:', error)
    return NextResponse.json(
      { error: 'Unable to create your Smartlink' },
      { status: 503, headers: getCorsHeaders(auth.origin) },
    )
  }
}
