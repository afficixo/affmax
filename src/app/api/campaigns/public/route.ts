import { NextResponse } from 'next/server'
import { getCorsHeaders } from '@/config/cors'
import {
  LEGACY_CRACK_BOUNTY_DEMO_OFFER_IDS,
  purgeLegacyCrackBountyDemoOffers,
  toCampaignOfferRecord,
} from '@/lib/campaign-offers'
import { prisma } from '@/lib/db/prisma'
import { visitorCountryCodeFromHeaders } from '@/lib/offer-geo'

/** Public catalog for Content Locker / OfferWall embeds (no auth). */
export async function GET(request: Request) {
  const origin = request.headers.get('origin') || null
  const headers = {
    ...getCorsHeaders(origin),
    'Cache-Control': 'private, no-store',
  }
  const visitorCountryCode = visitorCountryCodeFromHeaders(request.headers)
  const url = new URL(request.url)
  const placement = url.searchParams.get('placement')
  const placementFilter = placement === 'INCENTIVE' || placement === 'STANDARD' ? placement : 'INCENTIVE'

  try {
    await purgeLegacyCrackBountyDemoOffers(prisma)

    const offers = await prisma.campaignOffer.findMany({
      where: {
        placement: placementFilter,
        status: 'ACTIVE',
        ...(placementFilter === 'INCENTIVE' ? { incentiveActive: true } : {}),
        id: { notIn: [...LEGACY_CRACK_BOUNTY_DEMO_OFFER_IDS] },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 500,
    })

    return NextResponse.json(
      { offers: offers.map(toCampaignOfferRecord), visitorCountryCode },
      { headers },
    )
  } catch (error) {
    console.error('Public campaign offers failed:', error)
    return NextResponse.json(
      { error: 'Unable to load offers' },
      { status: 503, headers },
    )
  }
}
