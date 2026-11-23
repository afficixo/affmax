import { NextResponse } from 'next/server'
import { getCorsHeaders } from '@/config/cors'
import { getTokenFromCookie, getUserFromToken, normalizeEffectiveUserRole } from '@/lib/auth'
import { testPublisherGlobalPostback } from '@/lib/publisher-postback'

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
    if ((normalizeEffectiveUserRole(user) || user.role) !== 'PUBLISHER') {
      return NextResponse.json({ error: 'Only publishers can test a global postback.' }, {
        status: 403,
        headers: getCorsHeaders(origin),
      })
    }

    const result = await testPublisherGlobalPostback(user.id)
    if (!result.connected) {
      const status = result.code === 'url_not_configured'
        ? 400
        : result.code === 'publisher_not_found'
          ? 404
          : result.code === 'request_failed'
            ? 502
            : 400
      return NextResponse.json(result, { status, headers: getCorsHeaders(origin) })
    }
    return NextResponse.json(result, { headers: getCorsHeaders(origin) })
  } catch (error) {
    console.error('POST /api/postback/config/test failed:', error)
    return NextResponse.json({ error: 'Unable to test the postback URL.' }, {
      status: 500,
      headers: getCorsHeaders(origin),
    })
  }
}
