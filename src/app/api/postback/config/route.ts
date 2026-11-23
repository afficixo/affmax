import { NextResponse } from 'next/server'
import { getCorsHeaders } from '@/config/cors'
import { getTokenFromCookie, getUserFromToken, normalizeEffectiveUserRole } from '@/lib/auth'
import {
  buildMarketplacePostbackUrl,
  createPostbackToken,
  ensureMarketplacePostbackConfig,
  sumPublisherEarnings,
} from '@/lib/marketplace-postback'
import { getTrackingDomainOrigin } from '@/lib/tracking'

function resolveAppOrigin(request: Request): string {
  const configured = getTrackingDomainOrigin()
    || (process.env.NEXT_PUBLIC_APP_URL || '').trim()
    || (process.env.APP_URL || '').trim()
  if (configured) {
    try {
      return new URL(configured.includes('://') ? configured : `https://${configured}`).origin
    } catch {
      /* fall through */
    }
  }
  const proto = request.headers.get('x-forwarded-proto') || 'http'
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3001'
  return `${proto}://${host}`
}

function isValidHttpUrl(raw: string): boolean {
  const value = raw.trim()
  if (!value) return true
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export async function GET(request: Request) {
  const origin = request.headers.get('origin') || null
  try {
    const token = getTokenFromCookie(request.headers.get('cookie') || '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders(origin) })
    }
    const user = await getUserFromToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders(origin) })
    }

    const appOrigin = resolveAppOrigin(request)
    const { prisma } = await import('@/lib/db/prisma')
    const role = normalizeEffectiveUserRole(user) || user.role

    if (role === 'MANAGER') {
      const config = await ensureMarketplacePostbackConfig(user.id)
      const configs = await prisma.postbackConfig.findMany({
        where: { userId: config.userId, provider: 'MARKETPLACE' },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true, label: true, isActive: true, token: true },
      })
      return NextResponse.json({
        role,
        provider: config.provider,
        isActive: config.isActive,
        token: config.token,
        inboundUrl: buildMarketplacePostbackUrl(appOrigin, config.token),
        mapping: {
          s1: 'publisher_id',
          s2: 'offer_id',
          s3: 'publisher_sub_id_1',
          s4: 'publisher_sub_id_2',
          datetime: 'unix_timestamp',
          ip: 'conversion_ip',
          country: 'conversion_country',
        },
        marketplaces: configs.map((marketplace) => ({
          id: marketplace.id,
          label: marketplace.label,
          isActive: marketplace.isActive,
          inboundUrl: buildMarketplacePostbackUrl(appOrigin, marketplace.token),
        })),
      }, { headers: getCorsHeaders(origin) })
    }

    const publisherRows = await prisma.$queryRaw<Array<{
      globalPostbackUrl: string | null
      globalPostbackEnabled: boolean | null
    }>>`
      SELECT "globalPostbackUrl", "globalPostbackEnabled"
      FROM "users"
      WHERE "id" = ${user.id}
      LIMIT 1
    `
    const publisher = publisherRows[0]
    const earnings = await sumPublisherEarnings(user.id)
    return NextResponse.json({
      role,
      isActive: publisher?.globalPostbackEnabled !== false,
      url: publisher?.globalPostbackUrl || '',
      earningsSinceLastInvoice: earnings,
    }, { headers: getCorsHeaders(origin) })
  } catch (error) {
    console.error('GET /api/postback/config failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load postback config' },
      { status: 500, headers: getCorsHeaders(origin) },
    )
  }
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin') || null
  try {
    const token = getTokenFromCookie(request.headers.get('cookie') || '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders(origin) })
    }
    const user = await getUserFromToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders(origin) })
    }

    const role = normalizeEffectiveUserRole(user) || user.role
    if (role !== 'MANAGER') {
      return NextResponse.json({ error: 'Only managers can create marketplace postback URLs.' }, {
        status: 403,
        headers: getCorsHeaders(origin),
      })
    }

    let body: { label?: unknown } | null
    try {
      body = await request.json() as { label?: unknown } | null
    } catch {
      return NextResponse.json({ error: 'A marketplace name is required.' }, {
        status: 400,
        headers: getCorsHeaders(origin),
      })
    }

    const label = typeof body?.label === 'string' ? body.label.trim() : ''
    if (!label || label.length > 60 || /[\u0000-\u001f\u007f]/.test(label)) {
      return NextResponse.json({ error: 'Marketplace name must be between 1 and 60 characters.' }, {
        status: 400,
        headers: getCorsHeaders(origin),
      })
    }

    const { prisma } = await import('@/lib/db/prisma')
    const primaryConfig = await ensureMarketplacePostbackConfig(user.id)
    const config = await prisma.postbackConfig.create({
      data: {
        userId: primaryConfig.userId,
        provider: 'MARKETPLACE',
        label,
        token: createPostbackToken(),
        isActive: true,
      },
      select: { id: true, label: true, isActive: true, token: true },
    })
    const appOrigin = resolveAppOrigin(request)
    return NextResponse.json({
      marketplace: {
        id: config.id,
        label: config.label,
        isActive: config.isActive,
        inboundUrl: buildMarketplacePostbackUrl(appOrigin, config.token),
      },
    }, { status: 201, headers: getCorsHeaders(origin) })
  } catch (error) {
    console.error('POST /api/postback/config failed:', error)
    return NextResponse.json(
      { error: 'Unable to create marketplace postback URL.' },
      { status: 500, headers: getCorsHeaders(origin) },
    )
  }
}

export async function PATCH(request: Request) {
  const origin = request.headers.get('origin') || null
  try {
    const token = getTokenFromCookie(request.headers.get('cookie') || '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders(origin) })
    }
    const user = await getUserFromToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders(origin) })
    }

    let body: { configId?: unknown; isActive?: unknown; url?: unknown }
    try {
      const parsed = await request.json() as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return NextResponse.json({ error: 'A valid postback settings object is required.' }, {
          status: 400,
          headers: getCorsHeaders(origin),
        })
      }
      body = parsed as { configId?: unknown; isActive?: unknown; url?: unknown }
    } catch {
      return NextResponse.json({ error: 'A valid postback settings object is required.' }, {
        status: 400,
        headers: getCorsHeaders(origin),
      })
    }

    const { prisma } = await import('@/lib/db/prisma')

    const role = normalizeEffectiveUserRole(user) || user.role
    if (role === 'MANAGER') {
      const config = await ensureMarketplacePostbackConfig(user.id)
      const configId = typeof body.configId === 'string' ? body.configId.trim() : ''
      if (body.configId !== undefined && !configId) {
        return NextResponse.json({ error: 'A valid marketplace postback ID is required.' }, {
          status: 400,
          headers: getCorsHeaders(origin),
        })
      }
      if (configId) {
        if (typeof body.isActive !== 'boolean') {
          return NextResponse.json({ error: 'A postback status is required.' }, {
            status: 400,
            headers: getCorsHeaders(origin),
          })
        }
        const target = await prisma.postbackConfig.findFirst({
          where: {
            id: configId,
            userId: config.userId,
            provider: 'MARKETPLACE',
          },
        })
        if (!target) {
          return NextResponse.json({ error: 'Marketplace postback URL not found.' }, {
            status: 404,
            headers: getCorsHeaders(origin),
          })
        }
        const updated = await prisma.postbackConfig.update({
          where: { id: target.id },
          data: { isActive: body.isActive },
        })
        const appOrigin = resolveAppOrigin(request)
        return NextResponse.json({
          role: 'MANAGER',
          marketplace: {
            id: updated.id,
            label: updated.label,
            isActive: updated.isActive,
            inboundUrl: buildMarketplacePostbackUrl(appOrigin, updated.token),
          },
        }, { headers: getCorsHeaders(origin) })
      }
      const updated = await prisma.postbackConfig.update({
        where: { id: config.id },
        data: {
          isActive: typeof body.isActive === 'boolean' ? body.isActive : config.isActive,
        },
      })
      const appOrigin = resolveAppOrigin(request)
      return NextResponse.json({
        role: 'MANAGER',
        provider: updated.provider,
        isActive: updated.isActive,
        token: updated.token,
        inboundUrl: buildMarketplacePostbackUrl(appOrigin, updated.token),
      }, { headers: getCorsHeaders(origin) })
    }

    if (typeof body.url === 'string' && !isValidHttpUrl(body.url)) {
      return NextResponse.json(
        { error: 'Postback URL must be a valid http(s) URL.' },
        { status: 400, headers: getCorsHeaders(origin) },
      )
    }

    const nextUrl = typeof body.url === 'string' ? body.url.trim() : null
    const nextActive = typeof body.isActive === 'boolean' ? body.isActive : null
    await prisma.$executeRaw`
      UPDATE "users"
      SET
        "globalPostbackUrl" = COALESCE(${nextUrl}, "globalPostbackUrl"),
        "globalPostbackEnabled" = COALESCE(${nextActive}, "globalPostbackEnabled"),
        "updatedAt" = NOW()
      WHERE "id" = ${user.id}
    `
    const updatedRows = await prisma.$queryRaw<Array<{
      globalPostbackUrl: string | null
      globalPostbackEnabled: boolean | null
    }>>`
      SELECT "globalPostbackUrl", "globalPostbackEnabled"
      FROM "users"
      WHERE "id" = ${user.id}
      LIMIT 1
    `
    const updated = updatedRows[0]

    return NextResponse.json({
      role: 'PUBLISHER',
      isActive: updated?.globalPostbackEnabled !== false,
      url: updated?.globalPostbackUrl || '',
    }, { headers: getCorsHeaders(origin) })
  } catch (error) {
    console.error('PATCH /api/postback/config failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to save postback config' },
      { status: 500, headers: getCorsHeaders(origin) },
    )
  }
}
