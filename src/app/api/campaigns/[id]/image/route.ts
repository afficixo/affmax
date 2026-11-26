import { getCrackBountyImageUrl } from '@/lib/campaign-images'
import { proxyCampaignImage } from '@/lib/campaign-image-proxy'
import { prisma } from '@/lib/db/prisma'

type RouteContext = { params: Promise<{ id: string }> }

export const revalidate = 3600

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params
  if (!id) return new Response(null, { status: 404 })

  try {
    const [offer, application] = await Promise.all([
      prisma.campaignOffer.findUnique({
        where: { id },
        select: { imageSource: true },
      }),
      prisma.offerApplication.findFirst({
        where: { campaignId: id, campaignImage: { not: null } },
        select: { campaignImage: true },
        orderBy: { createdAt: 'desc' },
      }),
    ])
    const imageUrl = getCrackBountyImageUrl(offer?.imageSource)
      ?? getCrackBountyImageUrl(application?.campaignImage)
    if (!imageUrl) return new Response(null, { status: 404 })

    return proxyCampaignImage(imageUrl, ['image/png'])
  } catch (error) {
    console.error('Load proxied campaign image failed:', error)
    return new Response(null, { status: 502 })
  }
}
