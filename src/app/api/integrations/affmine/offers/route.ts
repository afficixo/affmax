import { NextResponse } from 'next/server'
import { getTokenFromCookie, getUserFromToken } from '@/lib/auth'
import { parseAffmineOffers } from '@/lib/affmine'

export const dynamic = 'force-dynamic'

const AFFMINE_OFFERS_URL = 'https://network.affmine.com/api/v1/getCampaigns'
const MAX_RESPONSE_LENGTH = 5_000_000

export async function GET(request: Request) {
  const token = getTokenFromCookie(request.headers.get('cookie') || '')
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await getUserFromToken(token)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (user.role !== 'MANAGER') {
    return NextResponse.json({ error: 'Only managers can import Affmine offers' }, { status: 403 })
  }

  const affId = process.env.AFFMINE_AFF_ID?.trim()
  const apiKey = process.env.AFFMINE_API_KEY?.trim()
  if (!affId || !apiKey) {
    return NextResponse.json(
      { error: 'Affmine is not configured. Set AFFMINE_AFF_ID and AFFMINE_API_KEY.' },
      { status: 503 },
    )
  }

  const url = new URL(AFFMINE_OFFERS_URL)
  url.searchParams.set('aff_id', affId)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('format', 'xml')
  url.searchParams.set('limit_row', '500')

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) {
      console.error(`Affmine campaign feed returned HTTP ${response.status}.`)
      return NextResponse.json({ error: 'Affmine could not load offers right now.' }, { status: 502 })
    }

    const xml = await response.text()
    if (xml.length > MAX_RESPONSE_LENGTH) {
      return NextResponse.json({ error: 'Affmine returned an unexpectedly large offer feed.' }, { status: 502 })
    }

    try {
      return NextResponse.json(
        { offers: parseAffmineOffers(xml) },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to read Affmine offers.'
      return NextResponse.json({ error: message }, { status: 502 })
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Affmine offer request timed out. Please try again.' }, { status: 504 })
    }
    console.error('Affmine campaign feed request failed.')
    return NextResponse.json({ error: 'Affmine could not load offers right now.' }, { status: 502 })
  }
}
