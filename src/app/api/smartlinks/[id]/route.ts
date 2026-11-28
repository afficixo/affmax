import { NextResponse } from 'next/server'
import { getCorsHeaders } from '@/config/cors'
import { getTokenFromCookie, getUserFromToken } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { PUBLISHER_SMARTLINK_KIND } from '@/lib/smartlink'

type RouteContext = {
  params: Promise<{ id: string }>
}

const MAX_SMARTLINK_NAME_LENGTH = 80

async function requirePublisher(request: Request) {
  const origin = request.headers.get('origin') || null
  const token = getTokenFromCookie(request.headers.get('cookie') || '')
  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders(origin) }) }
  }

  const user = await getUserFromToken(token)
  if (!user || user.role !== 'PUBLISHER' || user.status !== 'ACTIVE') {
    return { error: NextResponse.json({ error: 'Active publisher access is required' }, { status: 403, headers: getCorsHeaders(origin) }) }
  }
  return { user, origin }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requirePublisher(request)
  if ('error' in auth) return auth.error

  const { id: routeId } = await context.params
  const id = routeId?.trim()
  if (!id) {
    return NextResponse.json({ error: 'Smartlink id is required' }, {
      status: 400,
      headers: getCorsHeaders(auth.origin),
    })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'A Smartlink name is required' }, {
      status: 400,
      headers: getCorsHeaders(auth.origin),
    })
  }

  const name = body && typeof body === 'object' && 'name' in body && typeof body.name === 'string'
    ? body.name.trim()
    : ''
  if (!name || name.length > MAX_SMARTLINK_NAME_LENGTH) {
    return NextResponse.json({ error: `Enter a name up to ${MAX_SMARTLINK_NAME_LENGTH} characters` }, {
      status: 400,
      headers: getCorsHeaders(auth.origin),
    })
  }

  try {
    const updated = await prisma.incentiveTool.updateMany({
      where: {
        id,
        ownerId: auth.user.id,
        kind: PUBLISHER_SMARTLINK_KIND,
        isPublished: true,
      },
      data: { name },
    })
    if (!updated.count) {
      return NextResponse.json({ error: 'Smartlink not found' }, {
        status: 404,
        headers: getCorsHeaders(auth.origin),
      })
    }

    return NextResponse.json({ link: { id, name } }, {
      headers: getCorsHeaders(auth.origin),
    })
  } catch (error) {
    console.error('Update publisher Smartlink failed:', error)
    return NextResponse.json({ error: 'Unable to update your Smartlink' }, {
      status: 503,
      headers: getCorsHeaders(auth.origin),
    })
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requirePublisher(request)
  if ('error' in auth) return auth.error

  const { id: routeId } = await context.params
  const id = routeId?.trim()
  if (!id) {
    return NextResponse.json({ error: 'Smartlink id is required' }, {
      status: 400,
      headers: getCorsHeaders(auth.origin),
    })
  }

  try {
    const deleted = await prisma.incentiveTool.deleteMany({
      where: {
        id,
        ownerId: auth.user.id,
        kind: PUBLISHER_SMARTLINK_KIND,
        isPublished: true,
      },
    })
    if (!deleted.count) {
      return NextResponse.json({ error: 'Smartlink not found' }, {
        status: 404,
        headers: getCorsHeaders(auth.origin),
      })
    }

    return NextResponse.json({ ok: true }, {
      headers: getCorsHeaders(auth.origin),
    })
  } catch (error) {
    console.error('Delete publisher Smartlink failed:', error)
    return NextResponse.json({ error: 'Unable to remove your Smartlink' }, {
      status: 503,
      headers: getCorsHeaders(auth.origin),
    })
  }
}
