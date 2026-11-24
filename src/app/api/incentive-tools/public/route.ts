import { NextResponse } from 'next/server'
import { getCorsHeaders } from '@/config/cors'
import { prisma } from '@/lib/db/prisma'

export async function GET(request: Request) {
  const origin = request.headers.get('origin') || null
  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  const kind = url.searchParams.get('kind')
  if (!id || (kind !== 'locker' && kind !== 'offerwall')) {
    return NextResponse.json({ error: 'A valid tool ID and kind are required' }, { status: 400, headers: getCorsHeaders(origin) })
  }
  try {
    const tool = await prisma.incentiveTool.findFirst({
      where: { id, kind, isPublished: true },
    })
    if (!tool) {
      return NextResponse.json({ error: 'Tool not found' }, { status: 404, headers: getCorsHeaders(origin) })
    }
    return NextResponse.json({ tool }, {
      headers: {
        ...getCorsHeaders(origin),
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=300',
      },
    })
  } catch (error) {
    console.error('Public incentive tool failed:', error)
    return NextResponse.json({ error: 'Unable to load incentive tool' }, { status: 503, headers: getCorsHeaders(origin) })
  }
}
