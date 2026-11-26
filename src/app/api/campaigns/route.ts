import { NextResponse } from 'next/server'
import { getCorsHeaders } from '@/config/cors'
import { getTokenFromCookie, getUserFromToken } from '@/lib/auth'
import {
  type CampaignOfferInput,
  LEGACY_CRACK_BOUNTY_DEMO_OFFER_IDS,
  isLegacyCrackBountyDemoOfferId,
  normalizeCampaignOfferIds,
  normalizeCampaignOfferInput,
  purgeLegacyCrackBountyDemoOffers,
  toCampaignOfferRecord,
  toPrismaCreateData,
} from '@/lib/campaign-offers'
import { prisma } from '@/lib/db/prisma'

async function requireUser(request: Request) {
  const origin = request.headers.get('origin') || null
  const token = getTokenFromCookie(request.headers.get('cookie') || '')
  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders(origin) }) }
  }
  const user = await getUserFromToken(token)
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders(origin) }) }
  }
  return { user, origin }
}

export async function GET(request: Request) {
  const auth = await requireUser(request)
  if ('error' in auth) return auth.error

  const { user, origin } = auth
  const url = new URL(request.url)
  const placement = url.searchParams.get('placement')
  const placementFilter = placement === 'INCENTIVE' || placement === 'STANDARD' ? placement : undefined

  try {
    // Drop former hardcoded Crack Bounty demo rows so only manager-added offers remain.
    await purgeLegacyCrackBountyDemoOffers(prisma)

    const offers = await prisma.campaignOffer.findMany({
      where: {
        ...(placementFilter ? { placement: placementFilter } : {}),
        ...(user.role === 'PUBLISHER' ? { status: 'ACTIVE' } : {}),
        id: { notIn: [...LEGACY_CRACK_BOUNTY_DEMO_OFFER_IDS] },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 1000,
    })

    return NextResponse.json(
      { offers: offers.map(toCampaignOfferRecord) },
      { headers: getCorsHeaders(origin) },
    )
  } catch (error) {
    console.error('List campaign offers failed:', error)
    return NextResponse.json(
      { error: 'Unable to load campaign offers' },
      { status: 503, headers: getCorsHeaders(origin) },
    )
  }
}

export async function POST(request: Request) {
  const auth = await requireUser(request)
  if ('error' in auth) return auth.error

  const { user, origin } = auth
  if (user.role !== 'MANAGER') {
    return NextResponse.json(
      { error: 'Only managers can create offers' },
      { status: 403, headers: getCorsHeaders(origin) },
    )
  }

  try {
    const body = await request.json()
    const bulk = Array.isArray(body?.offers) ? (body.offers as unknown[]) : null
    const inputs = bulk
      ? bulk
          .map(normalizeCampaignOfferInput)
          .filter((value): value is CampaignOfferInput => value !== null)
      : (() => {
          const single = normalizeCampaignOfferInput(body)
          return single ? [single] : []
        })()

    const allowedInputs = inputs.filter((input) => !isLegacyCrackBountyDemoOfferId(input.id))
    if (!allowedInputs.length) {
      return NextResponse.json(
        { error: 'Valid offer details are required' },
        { status: 400, headers: getCorsHeaders(origin) },
      )
    }

    const created = []
    for (const input of allowedInputs) {
      const data = toPrismaCreateData(input, user.id)
      const row = await prisma.campaignOffer.upsert({
        where: { id: input.id },
        create: data,
        update: {
          name: data.name,
          payout: data.payout,
          country: data.country,
          countries: data.countries,
          action: data.action,
          requiresApproval: data.requiresApproval,
          imageSource: data.imageSource,
          offerTypes: data.offerTypes,
          category: data.category,
          device: data.device,
          description: data.description,
          offerLink: data.offerLink,
          marketplaceOfferId: input.marketplaceOfferId === undefined
            ? undefined
            : data.marketplaceOfferId,
          isHot: data.isHot,
          status: data.status,
          placement: data.placement,
          incentiveActive: data.incentiveActive,
        },
      })
      created.push(toCampaignOfferRecord(row))
    }

    return NextResponse.json({ offers: created }, { headers: getCorsHeaders(origin) })
  } catch (error) {
    console.error('Create campaign offers failed:', error)
    return NextResponse.json(
      { error: 'Unable to save campaign offers' },
      { status: 503, headers: getCorsHeaders(origin) },
    )
  }
}

export async function DELETE(request: Request) {
  const auth = await requireUser(request)
  if ('error' in auth) return auth.error

  const { user, origin } = auth
  if (user.role !== 'MANAGER') {
    return NextResponse.json(
      { error: 'Only managers can delete offers' },
      { status: 403, headers: getCorsHeaders(origin) },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'A valid list of offer IDs is required' },
      { status: 400, headers: getCorsHeaders(origin) },
    )
  }

  const ids = normalizeCampaignOfferIds(body && typeof body === 'object' && 'ids' in body
    ? body.ids
    : null)
  if (!ids?.length) {
    return NextResponse.json(
      { error: 'A valid list of offer IDs is required' },
      { status: 400, headers: getCorsHeaders(origin) },
    )
  }

  try {
    const result = await prisma.campaignOffer.deleteMany({ where: { id: { in: ids } } })
    return NextResponse.json(
      { deletedCount: result.count },
      { headers: getCorsHeaders(origin) },
    )
  } catch (error) {
    console.error('Delete campaign offers failed:', error)
    return NextResponse.json(
      { error: 'Unable to delete selected offers' },
      { status: 503, headers: getCorsHeaders(origin) },
    )
  }
}
