import { createHmac, randomInt } from 'node:crypto'
import { isIP } from 'node:net'
import { NextResponse } from 'next/server'
import { recordOfferClick } from '@/lib/analytics'
import { LEGACY_CRACK_BOUNTY_DEMO_OFFER_IDS } from '@/lib/campaign-offers'
import { prisma } from '@/lib/db/prisma'
import { ensurePublisherNumber } from '@/lib/db/user'
import { lookupCountryCode } from '@/lib/ip2location'
import { offerMatchesVisitorCountry, visitorCountryCodeFromHeaders } from '@/lib/offer-geo'
import {
  PUBLISHER_SMARTLINK_KIND,
  selectSmartlinkOfferForVisitor,
  SMARTLINK_OFFERS_CONFIG_ID,
  SMARTLINK_OFFERS_CONFIG_KIND,
  smartlinkOffersForCountry,
  type SmartlinkRoutableOffer,
} from '@/lib/smartlink'
import { buildMainOfferUrl } from '@/lib/tracking'

type RouteContext = {
  params: Promise<{ id: string }>
}

const LEGACY_SMARTLINK_KIND = 'smartlink'
const legacyOfferIds = new Set<string>(LEGACY_CRACK_BOUNTY_DEMO_OFFER_IDS)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getClientIp(headers: Headers) {
  const candidates = [
    headers.get('x-real-ip'),
    headers.get('x-forwarded-for')?.split(',')[0],
  ]
  return candidates
    .map((candidate) => candidate?.trim() ?? '')
    .find((candidate) => candidate && isIP(candidate)) ?? null
}

function hashVisitor(ipAddress: string, userAgent: string) {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is required to identify Smartlink visitors')
  return createHmac('sha256', secret)
    .update(`smartlink-visitor-v1\0${ipAddress}\0${userAgent}`)
    .digest('hex')
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

function unsupportedLocationResponse() {
  return new NextResponse(
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Location not supported</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f7f9f7;color:#344239;font:16px/1.5 system-ui,sans-serif}.message{max-width:440px;margin:24px;padding:32px;border:1px solid #e3eae4;border-radius:12px;background:#fff;text-align:center}h1{margin:0;font-size:22px;font-weight:650}p{margin:10px 0 0;color:#6d786f;font-size:14px}</style></head><body><main class="message"><h1>This offer does not support your location.</h1><p>There are no available offers for your country.</p></main></body></html>',
    {
      status: 403,
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Type': 'text/html; charset=utf-8',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  )
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'Smartlink route not found' }, { status: 404 })
  }

  try {
    const group = await prisma.incentiveTool.findFirst({
      where: { id, kind: { in: [LEGACY_SMARTLINK_KIND, PUBLISHER_SMARTLINK_KIND] }, isPublished: true },
      select: {
        id: true,
        kind: true,
        fields: true,
        ownerId: true,
        owner: { select: { publisherNumber: true } },
      },
    })
    if (!group || !isRecord(group.fields)) {
      return NextResponse.json({ error: 'Smartlink route not found' }, { status: 404 })
    }

    if (group.kind === LEGACY_SMARTLINK_KIND) {
      const countryCode = visitorCountryCodeFromHeaders(request.headers)
      const geoRules = Array.isArray(group.fields.geoRules) ? group.fields.geoRules : []
      const matchingRule = countryCode
        ? geoRules.find((rule) => isRecord(rule) && rule.countryCode === countryCode)
        : undefined
      const offers = isRecord(matchingRule) && Array.isArray(matchingRule.offers)
        ? matchingRule.offers
          .map((offer) => isRecord(offer) ? normalizeHttpUrl(offer.url) : null)
          .filter((url): url is string => url !== null)
        : []
      let destination = offers.length ? offers[randomInt(offers.length)] : null

      if (!destination) {
        const activeOffers = await prisma.campaignOffer.findMany({
          where: {
            status: 'ACTIVE',
            id: { notIn: [...LEGACY_CRACK_BOUNTY_DEMO_OFFER_IDS] },
            OR: [
              { placement: 'STANDARD' },
              { placement: 'INCENTIVE', incentiveActive: true },
            ],
          },
          select: { country: true, countries: true, offerLink: true },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 1000,
        })
        const availableOffers = activeOffers.flatMap((offer) => {
          const url = normalizeHttpUrl(offer.offerLink)
          return url ? [{ country: offer.country, countries: offer.countries, url }] : []
        })
        const candidates = smartlinkOffersForCountry(availableOffers, countryCode)
        if (candidates.length) {
          destination = candidates[randomInt(candidates.length)].url
        }
      }

      if (!destination) {
        return NextResponse.json({ error: 'Smartlink route has no valid destination' }, { status: 410 })
      }

      const response = NextResponse.redirect(destination, 302)
      response.headers.set('Cache-Control', 'private, no-store')
      response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
      return response
    }

    const config = await prisma.incentiveTool.findUnique({
      where: { id: SMARTLINK_OFFERS_CONFIG_ID },
      select: { kind: true, selectedOfferIds: true },
    })
    if (config && config.kind !== SMARTLINK_OFFERS_CONFIG_KIND) {
      return NextResponse.json({ error: 'Smartlink offers are unavailable' }, { status: 503 })
    }

    const selectedIds = (config?.selectedOfferIds ?? []).filter((offerId) => !legacyOfferIds.has(offerId))
    const offerRows = selectedIds.length
      ? await prisma.campaignOffer.findMany({
          where: {
            id: { in: selectedIds },
            status: 'ACTIVE',
            offerLink: { not: null },
          },
          select: { id: true, country: true, countries: true, offerLink: true },
          take: 1000,
        })
      : []
    const routableOffers: SmartlinkRoutableOffer[] = offerRows.flatMap((offer) => {
      const url = normalizeHttpUrl(offer.offerLink)
      return url
        ? [{ id: offer.id, country: offer.country, countries: offer.countries, url }]
        : []
    })
    if (!routableOffers.length) {
      return NextResponse.json({ error: 'No active Smartlink offers are available' }, { status: 410 })
    }

    const ipAddress = getClientIp(request.headers)
    const userAgent = request.headers.get('user-agent')?.trim().slice(0, 512) ?? ''
    if (!ipAddress) return unsupportedLocationResponse()
    if (!userAgent) {
      return NextResponse.json({ error: 'Unable to identify visitor for Smartlink routing' }, { status: 503 })
    }

    const countryCode = await lookupCountryCode(ipAddress)
      || visitorCountryCodeFromHeaders(request.headers)
    if (!countryCode || !routableOffers.some((offer) => offerMatchesVisitorCountry(offer, countryCode))) {
      return unsupportedLocationResponse()
    }

    const publisherNumber = group.owner.publisherNumber
      ?? await ensurePublisherNumber(group.ownerId)
    if (publisherNumber == null) {
      return NextResponse.json({ error: 'Smartlink owner is missing a publisher ID' }, { status: 503 })
    }

    const visitorHash = hashVisitor(ipAddress, userAgent)
    const historyCountryCode = countryCode ?? 'XX'
    const selection = await prisma.$transaction(async (transaction) => {
      const lockKey = `${visitorHash}:${historyCountryCode}`
      await transaction.$queryRaw<Array<{ locked: boolean }>>`
        SELECT TRUE AS locked
        FROM pg_advisory_xact_lock(hashtext(${group.id}), hashtext(${lockKey}))
      `

      const history = await transaction.smartlinkVisitorCycle.upsert({
        where: {
          smartlinkId_visitorHash_countryCode: {
            smartlinkId: group.id,
            visitorHash,
            countryCode: historyCountryCode,
          },
        },
        create: {
          smartlinkId: group.id,
          visitorHash,
          countryCode: historyCountryCode,
          seenOfferIds: [],
        },
        update: {},
        select: { seenOfferIds: true },
      })
      const next = selectSmartlinkOfferForVisitor(
        routableOffers,
        countryCode,
        history.seenOfferIds,
        randomInt,
      )
      if (!next) return null

      await transaction.smartlinkVisitorCycle.update({
        where: {
          smartlinkId_visitorHash_countryCode: {
            smartlinkId: group.id,
            visitorHash,
            countryCode: historyCountryCode,
          },
        },
        data: { seenOfferIds: next.seenOfferIds },
      })
      return next.offer
    })
    if (!selection) {
      return unsupportedLocationResponse()
    }

    const requestUrl = new URL(request.url)
    const subId1 = requestUrl.searchParams.get('s1')?.slice(0, 100) ?? ''
    const subId2 = requestUrl.searchParams.get('s2')?.slice(0, 100) ?? ''
    const subId3 = requestUrl.searchParams.get('s3')?.slice(0, 100) ?? ''
    try {
      await recordOfferClick({
        publisherNumber,
        publisherUserId: group.ownerId,
        offerId: selection.id,
        sub1: subId1,
        sub2: subId2,
        ipAddress,
        userAgent,
        countryCode,
        smartlinkId: group.id,
        smartlinkVisitorHash: visitorHash,
      })
    } catch (error) {
      console.error('Record Smartlink offer click failed:', error)
    }

    const destination = buildMainOfferUrl({
      mainOfferBase: selection.url,
      publisherId: publisherNumber,
      subId1,
      subId2,
      subId3,
    })
    const response = NextResponse.redirect(destination, 302)
    response.headers.set('Cache-Control', 'private, no-store')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    return response
  } catch (error) {
    console.error('Resolve Smartlink route failed:', error)
    return NextResponse.json({ error: 'Unable to resolve Smartlink route' }, { status: 503 })
  }
}
