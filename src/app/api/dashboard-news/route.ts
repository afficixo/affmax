import { NextResponse } from 'next/server'
import { getCorsHeaders } from '@/config/cors'
import { getTokenFromCookie, getUserFromToken } from '@/lib/auth'
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

function serializePost(post: {
  id: string
  title: string
  body: string
  createdAt: Date
  author: { username: string; fullName: string | null }
}) {
  return {
    id: post.id,
    title: post.title,
    body: post.body,
    createdAt: post.createdAt.toISOString(),
    authorName: post.author.fullName?.trim() || post.author.username,
  }
}

export async function GET(request: Request) {
  const auth = await requireUser(request)
  if ('error' in auth) return auth.error

  try {
    const posts = await prisma.dashboardNewsPost.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
      include: { author: { select: { username: true, fullName: true } } },
    })
    return NextResponse.json({ posts: posts.map(serializePost) }, { headers: getCorsHeaders(auth.origin) })
  } catch (error) {
    console.error('Load dashboard news failed:', error)
    return NextResponse.json(
      { error: 'Unable to load news and updates' },
      { status: 503, headers: getCorsHeaders(auth.origin) },
    )
  }
}

export async function POST(request: Request) {
  const auth = await requireUser(request)
  if ('error' in auth) return auth.error

  const { user, origin } = auth
  if (user.role !== 'MANAGER') {
    return NextResponse.json(
      { error: 'Only managers can publish updates' },
      { status: 403, headers: getCorsHeaders(origin) },
    )
  }

  let input: unknown
  try {
    input = await request.json()
  } catch {
    return NextResponse.json({ error: 'A valid title and message are required' }, { status: 400, headers: getCorsHeaders(origin) })
  }

  const title = typeof input === 'object' && input !== null && 'title' in input && typeof input.title === 'string'
    ? input.title.trim()
    : ''
  const body = typeof input === 'object' && input !== null && 'body' in input && typeof input.body === 'string'
    ? input.body.trim()
    : ''

  if (!title || title.length > 80 || !body || body.length > 600) {
    return NextResponse.json(
      { error: 'Add a title (up to 80 characters) and a message (up to 600 characters)' },
      { status: 400, headers: getCorsHeaders(origin) },
    )
  }

  try {
    const post = await prisma.dashboardNewsPost.create({
      data: { title, body, authorId: user.id },
      include: { author: { select: { username: true, fullName: true } } },
    })
    return NextResponse.json({ post: serializePost(post) }, { status: 201, headers: getCorsHeaders(origin) })
  } catch (error) {
    console.error('Create dashboard news post failed:', error)
    return NextResponse.json(
      { error: 'Unable to publish update' },
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
      { error: 'Only managers can remove updates' },
      { status: 403, headers: getCorsHeaders(origin) },
    )
  }

  const id = new URL(request.url).searchParams.get('id')?.trim()
  if (!id) {
    return NextResponse.json({ error: 'A post ID is required' }, { status: 400, headers: getCorsHeaders(origin) })
  }

  try {
    const result = await prisma.dashboardNewsPost.deleteMany({ where: { id } })
    if (!result.count) {
      return NextResponse.json({ error: 'Update not found' }, { status: 404, headers: getCorsHeaders(origin) })
    }
    return NextResponse.json({ success: true }, { headers: getCorsHeaders(origin) })
  } catch (error) {
    console.error('Delete dashboard news post failed:', error)
    return NextResponse.json(
      { error: 'Unable to remove update' },
      { status: 503, headers: getCorsHeaders(origin) },
    )
  }
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get('origin') || '*'
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(origin) })
}
