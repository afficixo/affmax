import { randomInt } from 'node:crypto'
import { NextResponse } from 'next/server'
import { LEGACY_CRACK_BOUNTY_DEMO_OFFER_IDS } from '@/lib/campaign-offers'
import { prisma } from '@/lib/db/prisma'
import { visitorCountryCodeFromHeaders } from '@/lib/offer-geo'
import { smartlinkOffersForCountry } from '@/lib/smartlink'

type RouteContext = {
  params: Promise<{ id: string }>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'Smartlink route not found' }, { status: 404 })
  }

  try {
    const group = await prisma.incentiveTool.findFirst({
      where: { id, kind: 'smartlink', isPublished: true },
      select: { fields: true },
    })
    if (!group || !isRecord(group.fields)) {
      return NextResponse.json({ error: 'Smartlink route not found' }, { status: 404 })
    }

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
  } catch (error) {
    console.error('Resolve Smartlink route failed:', error)
    return NextResponse.json({ error: 'Unable to resolve Smartlink route' }, { status: 503 })
  }
}
