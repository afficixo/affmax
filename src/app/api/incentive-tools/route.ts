import { NextResponse } from 'next/server'
import { getCorsHeaders } from '@/config/cors'
import { getTokenFromCookie, getUserFromToken } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'

async function requireManager(request: Request) {
  const origin = request.headers.get('origin') || null
  const token = getTokenFromCookie(request.headers.get('cookie') || '')
  if (!token) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders(origin) }) }
  const user = await getUserFromToken(token)
  if (!user || user.role !== 'MANAGER') {
    return { error: NextResponse.json({ error: 'Only managers can manage incentive tools' }, { status: 403, headers: getCorsHeaders(origin) }) }
  }
  return { user, origin }
}

export async function GET(request: Request) {
  const auth = await requireManager(request)
  if ('error' in auth) return auth.error
  try {
    const tools = await prisma.incentiveTool.findMany({
      where: { ownerId: auth.user.id },
      orderBy: { updatedAt: 'desc' },
    })
    return NextResponse.json({ tools }, { headers: getCorsHeaders(auth.origin) })
  } catch (error) {
    console.error('List incentive tools failed:', error)
    return NextResponse.json({ error: 'Unable to load incentive tools' }, { status: 503, headers: getCorsHeaders(auth.origin) })
  }
}

export async function POST(request: Request) {
  const auth = await requireManager(request)
  if ('error' in auth) return auth.error
  try {
    const body = await request.json()
    const tool = body?.tool ?? body
    if (!tool || typeof tool.id !== 'string' || (tool.kind !== 'locker' && tool.kind !== 'offerwall')) {
      return NextResponse.json({ error: 'Valid incentive tool details are required' }, { status: 400, headers: getCorsHeaders(auth.origin) })
    }
    const existing = await prisma.incentiveTool.findUnique({ where: { id: tool.id }, select: { ownerId: true } })
    if (existing && existing.ownerId !== auth.user.id) {
      return NextResponse.json({ error: 'This incentive tool belongs to another account' }, { status: 409, headers: getCorsHeaders(auth.origin) })
    }
    const saved = await prisma.incentiveTool.upsert({
      where: { id: tool.id },
      create: {
        id: tool.id,
        kind: tool.kind,
        name: typeof tool.name === 'string' ? tool.name : '',
        fields: tool.fields && typeof tool.fields === 'object' ? tool.fields : {},
        toggles: tool.toggles && typeof tool.toggles === 'object' ? tool.toggles : {},
        selectedOfferIds: Array.isArray(tool.selectedOfferIds) ? tool.selectedOfferIds.filter((id: unknown): id is string => typeof id === 'string') : [],
        isPublished: true,
        ownerId: auth.user.id,
      },
      update: {
        kind: tool.kind,
        name: typeof tool.name === 'string' ? tool.name : '',
        fields: tool.fields && typeof tool.fields === 'object' ? tool.fields : {},
        toggles: tool.toggles && typeof tool.toggles === 'object' ? tool.toggles : {},
        selectedOfferIds: Array.isArray(tool.selectedOfferIds) ? tool.selectedOfferIds.filter((id: unknown): id is string => typeof id === 'string') : [],
        isPublished: true,
      },
    })
    return NextResponse.json({ tool: saved }, { headers: getCorsHeaders(auth.origin) })
  } catch (error) {
    console.error('Save incentive tool failed:', error)
    return NextResponse.json({ error: 'Unable to save incentive tool' }, { status: 503, headers: getCorsHeaders(auth.origin) })
  }
}

export async function DELETE(request: Request) {
  const auth = await requireManager(request)
  if ('error' in auth) return auth.error
  try {
    const body = await request.json()
    if (!body || typeof body.id !== 'string') {
      return NextResponse.json({ error: 'A valid tool ID is required' }, { status: 400, headers: getCorsHeaders(auth.origin) })
    }
    const deleted = await prisma.incentiveTool.deleteMany({ where: { id: body.id, ownerId: auth.user.id } })
    return NextResponse.json({ deletedCount: deleted.count }, { headers: getCorsHeaders(auth.origin) })
  } catch (error) {
    console.error('Delete incentive tool failed:', error)
    return NextResponse.json({ error: 'Unable to delete incentive tool' }, { status: 503, headers: getCorsHeaders(auth.origin) })
  }
}
