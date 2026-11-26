const MAX_IMAGE_BYTES = 5 * 1024 * 1024
type SupportedImageContentType = 'image/jpeg' | 'image/png'

function isSupportedImageContentType(value: string): value is SupportedImageContentType {
  return value === 'image/jpeg' || value === 'image/png'
}

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

  if (!size) return null
  const image = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    image.set(chunk, offset)
    offset += chunk.byteLength
  }
  return image
}

export async function proxyCampaignImage(
  imageUrl: string,
  acceptedContentTypes: readonly SupportedImageContentType[],
): Promise<Response> {
  try {
    const upstream = await fetch(imageUrl, {
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
    })
    if (upstream.status === 404) return new Response(null, { status: 404 })
    if (!upstream.ok) return new Response(null, { status: 502 })
    const contentType = upstream.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() ?? ''
    if (!isSupportedImageContentType(contentType) || !acceptedContentTypes.includes(contentType)) {
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
        'Content-Type': contentType,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('Load proxied campaign image failed:', error)
    return new Response(null, { status: 502 })
  }
}
