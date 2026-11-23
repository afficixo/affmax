import { NextResponse } from 'next/server'
import { getCorsHeaders } from '@/config/cors'
import { getTokenFromCookie, getUserFromToken, normalizeEffectiveUserRole } from '@/lib/auth'
import { ConversionReversalError, reversePublisherConversion } from '@/lib/conversion-reversal'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const origin = request.headers.get('origin') || null
  const token = getTokenFromCookie(request.headers.get('cookie') || '')
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders(origin) })
  }

  const user = await getUserFromToken(token)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders(origin) })
  }
  if ((normalizeEffectiveUserRole(user) || user.role) !== 'MANAGER') {
    return NextResponse.json({ error: 'Only managers can reverse conversions.' }, {
      status: 403,
      headers: getCorsHeaders(origin),
    })
  }

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: 'Conversion id required.' }, {
      status: 400,
      headers: getCorsHeaders(origin),
    })
  }

  try {
    const result = await reversePublisherConversion(id)
    return NextResponse.json(result, { headers: getCorsHeaders(origin) })
  } catch (error) {
    if (error instanceof ConversionReversalError) {
      return NextResponse.json({ error: error.message }, {
        status: error.statusCode,
        headers: getCorsHeaders(origin),
      })
    }
    console.error('Reverse conversion failed:', error)
    return NextResponse.json({ error: 'Unable to reverse conversion.' }, {
      status: 503,
      headers: getCorsHeaders(origin),
    })
  }
}
