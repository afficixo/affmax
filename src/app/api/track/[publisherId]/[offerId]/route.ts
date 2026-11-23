import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { recordOfferClick } from '@/lib/analytics'
import {
  DEFAULT_MAIN_OFFER_BASE,
  buildMainOfferUrl,
  decodeTrackingId,
  sanitizeTrackingToken,
} from '@/lib/tracking'

type RouteContext = {
  params: Promise<{ publisherId: string; offerId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { publisherId: rawPublisherId, offerId: rawOfferId } = await context.params
  const publisherId = sanitizeTrackingToken(decodeTrackingId(rawPublisherId, 'P'))
  const offerId = sanitizeTrackingToken(decodeTrackingId(rawOfferId, 'O'))

  if (!publisherId || !offerId) {
    return NextResponse.json({ error: 'Invalid tracking link' }, { status: 400 })
  }

  const requestUrl = new URL(request.url)
  const subId1 = requestUrl.searchParams.get('s1') || ''
  const subId2 = requestUrl.searchParams.get('s2') || ''
  const publisherNumber = Number(publisherId)

  let mainOfferBase = DEFAULT_MAIN_OFFER_BASE
  try {
    const offer = await prisma.campaignOffer.findUnique({
      where: { id: offerId },
      select: { offerLink: true, status: true },
    })
    if (offer?.offerLink?.trim()) {
      mainOfferBase = offer.offerLink.trim()
    }
    if (offer?.status === 'PAUSED') {
      return NextResponse.json({ error: 'Offer is paused' }, { status: 410 })
    }

    if (Number.isFinite(publisherNumber) && publisherNumber > 0) {
      const publisher = await prisma.user.findFirst({
        where: { publisherNumber },
        select: { id: true },
      })
      const ipAddress = request.headers.get('x-real-ip')?.trim()
        || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || null
      await recordOfferClick({
        publisherNumber,
        publisherUserId: publisher?.id || null,
        offerId,
        sub1: subId1,
        sub2: subId2,
        ipAddress,
        userAgent: request.headers.get('user-agent'),
        useProviderIpFallback: process.env.NODE_ENV === 'development',
      })
    }
  } catch (error) {
    console.error('Unable to record offer click:', error)
    // Still redirect even if click logging fails.
  }

  const destination = buildMainOfferUrl({
    mainOfferBase,
    publisherId,
    offerId,
    subId1,
    subId2,
  })

  return NextResponse.redirect(destination, 302)
}
