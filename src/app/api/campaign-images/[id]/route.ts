import { getAffmineCampaignImageUrl } from '@/lib/campaign-images'
import { proxyCampaignImage } from '@/lib/campaign-image-proxy'

type RouteContext = { params: Promise<{ id: string }> }

export const revalidate = 3600

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params
  const imageUrl = getAffmineCampaignImageUrl(id)
  if (!imageUrl) return new Response(null, { status: 404 })

  return proxyCampaignImage(imageUrl, ['image/jpeg', 'image/png'])
}
