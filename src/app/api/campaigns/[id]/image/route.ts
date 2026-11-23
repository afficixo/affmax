import { getCrackBountyImageUrl } from '@/lib/campaign-images'
import { prisma } from '@/lib/db/prisma'

type RouteContext = { params: Promise<{ id: string }> }

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export const revalidate = 3600

async function readImageBody(response: Response): Promise<Uint8Array | null> {
  const reader = response.body?.getReader()
  if (!reader) return null

  const chunks: Uint8Array[] = []
  let size = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_IMAGE_BYTES) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }

  const image = new Uint8Array(size)
  if (!size) return null
  let offset = 0
  for (const chunk of chunks) {
    image.set(chunk, offset)
    offset += chunk.byteLength
  }
  return image
}

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

    const upstream = await fetch(imageUrl, {
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
    })
    if (upstream.status === 404) return new Response(null, { status: 404 })
    if (!upstream.ok) return new Response(null, { status: 502 })
    if (upstream.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'image/png') {
      return new Response(null, { status: 502 })
    }

    const contentLength = Number(upstream.headers.get('content-length'))
    if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
      return new Response(null, { status: 502 })
    }

    const image = await readImageBody(upstream)
    if (!image) return new Response(null, { status: 502 })
    const body = new ArrayBuffer(image.byteLength)
    new Uint8Array(body).set(image)

    return new Response(body, {
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'Content-Type': 'image/png',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('Load proxied campaign image failed:', error)
    return new Response(null, { status: 502 })
  }
}
