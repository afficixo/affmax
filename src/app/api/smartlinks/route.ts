import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { getCorsHeaders } from '@/config/cors'
import { getTokenFromCookie, getUserFromToken } from '@/lib/auth'
import {
  LEGACY_CRACK_BOUNTY_DEMO_OFFER_IDS,
} from '@/lib/campaign-offers'
import { prisma } from '@/lib/db/prisma'
import {
  publisherSmartlinkTrackingCode,
  PUBLISHER_SMARTLINK_KIND,
  SMARTLINK_OFFERS_CONFIG_ID,
  SMARTLINK_OFFERS_CONFIG_KIND,
} from '@/lib/smartlink'
import {
  ensurePublisherSmartlinkSubId,
  generatePublisherSmartlinkSubId,
} from '@/lib/smartlink-subid'

const MAX_SMARTLINK_NAME_LENGTH = 80
const MAX_SUBID_CREATION_ATTEMPTS = 8
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

async function createPublisherSmartlink(name: string, ownerId: string) {
  for (let attempt = 0; attempt < MAX_SUBID_CREATION_ATTEMPTS; attempt += 1) {
    const id = randomUUID()
    const matchingReportCode = await prisma.incentiveTool.findFirst({
      where: {
        id: { startsWith: publisherSmartlinkTrackingCode(id) },
        kind: PUBLISHER_SMARTLINK_KIND,
      },
      select: { id: true },
    })
    if (matchingReportCode) continue

    try {
      return await prisma.incentiveTool.create({
        data: {
          id,
          kind: PUBLISHER_SMARTLINK_KIND,
          publisherSubId: generatePublisherSmartlinkSubId(),
          name,
          fields: {},
          toggles: {},
          selectedOfferIds: [],
          isPublished: true,
          ownerId,
        },
        select: { id: true, name: true, createdAt: true, publisherSubId: true },
      })
    } catch (error) {
      const isPublisherSubIdCollision = error instanceof Prisma.PrismaClientKnownRequestError
        && error.code === 'P2002'
      if (!isPublisherSubIdCollision || attempt === MAX_SUBID_CREATION_ATTEMPTS - 1) throw error
    }
  }

  throw new Error('Unable to allocate a unique Smartlink SubID')
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
      select: { id: true, name: true, createdAt: true, publisherSubId: true },
      orderBy: { createdAt: 'desc' },
    })
    const linksWithSubIds = await Promise.all(links.map(async (link) => {
      const publisherSubId = await ensurePublisherSmartlinkSubId(link.id, link.publisherSubId)
      return publisherSubId ? { ...link, publisherSubId } : null
    }))
    return NextResponse.json({ links: linksWithSubIds.filter((link) => link !== null) }, {
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

    const link = await createPublisherSmartlink(name, auth.user.id)
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
