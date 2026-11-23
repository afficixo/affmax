import { createHash, randomBytes } from 'crypto'
import { prisma } from '@/lib/db/prisma'
import { lookupCountryCode } from '@/lib/ip2location'
import {
  DEFAULT_MARKETPLACE_POSTBACK_TOKENS,
  type MarketplacePostbackTokens,
} from '@/lib/postback-tokens'
import { decodeTrackingId } from '@/lib/tracking'

type StoredMarketplacePostbackTokens = {
  s1Token: string
  s2Token: string
  s3Token: string
  s4Token: string
  ipToken: string
}

export function createPostbackToken(): string {
  return randomBytes(24).toString('hex')
}

/**
 * Shared manager inbound URL fields for every configured marketplace:
 * #s1# #s2# #s3# #s4# #ip#
 *
 * Our tracking map on offer links:
 *   s1 = prefixed publisher ID, s2 = prefixed offer ID
 *   s3 = publisher sub1, s4 = publisher sub2
 */
export function getMarketplacePostbackTokens(
  config: StoredMarketplacePostbackTokens,
): MarketplacePostbackTokens {
  return {
    s1: config.s1Token,
    s2: config.s2Token,
    s3: config.s3Token,
    s4: config.s4Token,
    ip: config.ipToken,
  }
}

export function buildMarketplacePostbackUrl(
  origin: string,
  token: string,
  tokens: MarketplacePostbackTokens = DEFAULT_MARKETPLACE_POSTBACK_TOKENS,
): string {
  const base = origin.replace(/\/$/, '')
  // Keep the marketplace macro syntax intact so its system can substitute values.
  return `${base}/api/postback/in/${encodeURIComponent(token)}`
    + `?s1=${tokens.s1}&s2=${tokens.s2}&s3=${tokens.s3}&s4=${tokens.s4}&ip=${tokens.ip}`
}

export async function ensureMarketplacePostbackConfig(managerId: string) {
  let userId = managerId

  // Sessions minted while the DB was empty use `local-{username}` ids that
  // cannot satisfy the postback_configs.userId foreign key.
  if (userId.startsWith('local-')) {
    const { ensureManagerDbUser } = await import('@/lib/manager-auth')
    const manager = await ensureManagerDbUser()
    if (!manager) {
      throw new Error('Manager account is not initialized. Sign out and sign in again.')
    }
    userId = manager.id
  } else {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })
    if (!user) {
      const { ensureManagerDbUser } = await import('@/lib/manager-auth')
      const manager = await ensureManagerDbUser()
      if (!manager) {
        throw new Error('Manager account is not initialized. Sign out and sign in again.')
      }
      userId = manager.id
    }
  }

  const existing = await prisma.postbackConfig.findFirst({
    where: { userId, provider: 'MARKETPLACE' },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })
  if (existing) return existing

  try {
    return await prisma.postbackConfig.create({
      data: {
        userId,
        provider: 'MARKETPLACE',
        label: 'Main marketplace inbound',
        token: createPostbackToken(),
        isActive: true,
      },
    })
  } catch (error) {
    console.error('ensureMarketplacePostbackConfig create failed:', error)
    const raced = await prisma.postbackConfig.findFirst({
      where: { userId, provider: 'MARKETPLACE' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    if (!raced) {
      throw new Error(
        error instanceof Error
          ? `Unable to create marketplace postback config: ${error.message}`
          : 'Unable to create marketplace postback config',
      )
    }
    return raced
  }
}

function firstParam(params: URLSearchParams, keys: string[]): string {
  for (const key of keys) {
    const value = params.get(key)
    if (value != null && value.trim() && !/^#.*#$/.test(value.trim())) {
      return value.trim()
    }
  }
  return ''
}

function parseOccurredAt(raw: string): Date | null {
  if (!raw) return null
  if (/^\d{9,13}$/.test(raw)) {
    const num = Number(raw)
    const ms = raw.length <= 10 ? num * 1000 : num
    const date = new Date(ms)
    return Number.isNaN(date.getTime()) ? null : date
  }
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

function buildExternalKey(parts: {
  token: string
  publisherKey: string
  offerKey: string
  datetime: string
  ip: string
  s3: string
  s4: string
}) {
  return createHash('sha256')
    .update([
      parts.token,
      parts.publisherKey,
      parts.offerKey,
      parts.datetime,
      parts.ip,
      parts.s3,
      parts.s4,
    ].join('|'))
    .digest('hex')
}

export type IngestPostbackResult =
  | {
      ok: true
      leadId: string
      duplicate?: boolean
      publisherNumber: number
      offerId: string
      payout: number
      publisherPostback?: {
        fired: boolean
        status?: number
        skipped?: string
        url?: string
      }
    }
  | { ok: false; status: number; error: string }

/**
 * Marketplace → our app.
 * Mapping (already used on tracking links):
 *   s1 = prefixed publisher ID, s2 = prefixed offer ID
 *   s3 = publisher sub id 1
 *   s4 = publisher sub id 2
 */
export async function ingestMarketplacePostback(
  token: string,
  params: URLSearchParams,
): Promise<IngestPostbackResult> {
  const config = await prisma.postbackConfig.findFirst({
    where: { token, isActive: true, provider: 'MARKETPLACE' },
  })
  if (!config) {
    return { ok: false, status: 404, error: 'Unknown or inactive postback token' }
  }

  const s1 = decodeTrackingId(firstParam(params, ['s1', 'sub1', 'sub_id_1']), 'P')
  const s2 = decodeTrackingId(firstParam(params, ['s2', 'sub2', 'sub_id_2', 'offer_id', 'offerid']), 'O')
  const s3 = firstParam(params, ['s3', 'sub3', 'sub_id_3'])
  const s4 = firstParam(params, ['s4', 'sub4', 'sub_id_4'])
  const datetime = firstParam(params, ['datetime', 'time', 'timestamp'])
  const ip = firstParam(params, ['ip', 'ip_address', 'ipaddress'])
  const suppliedCountry = firstParam(params, ['country', 'county', 'geo']).toUpperCase()
  const country = /^[A-Z]{2}$/.test(suppliedCountry) ? suppliedCountry : ''

  if (!s1 || !s2) {
    return { ok: false, status: 400, error: 'Missing required s1 (publisher id) or s2 (offer id)' }
  }

  const publisherNumber = Number(s1)
  if (!Number.isFinite(publisherNumber) || publisherNumber <= 0) {
    return { ok: false, status: 400, error: 'Invalid publisher id in s1' }
  }

  const publisher = await prisma.user.findFirst({
    where: {
      publisherNumber,
      role: { in: ['PUBLISHER', 'MANAGER'] },
    },
    select: { id: true, publisherNumber: true, status: true },
  })
  if (!publisher || publisher.publisherNumber == null) {
    return { ok: false, status: 404, error: `Publisher #${publisherNumber} not found` }
  }

  const offer = await prisma.campaignOffer.findUnique({
    where: { id: s2 },
    select: { id: true, name: true, payout: true, status: true },
  })
  if (!offer) {
    return { ok: false, status: 404, error: `Offer #${s2} not found` }
  }

  const payout = offer.payout
  if (!Number.isFinite(payout) || payout < 0) {
    return { ok: false, status: 400, error: 'Invalid payout' }
  }

  const parsedOccurredAt = parseOccurredAt(datetime)
  if (datetime && !parsedOccurredAt) {
    return { ok: false, status: 400, error: 'Invalid conversion datetime' }
  }
  const occurredAt = parsedOccurredAt ?? new Date()
  const countryCode = country || await lookupCountryCode(ip)
  const externalKey = buildExternalKey({
    token,
    publisherKey: s1,
    offerKey: s2,
    datetime: datetime || occurredAt.toISOString(),
    ip,
    s3,
    s4,
  })

  const existing = await prisma.conversionLead.findUnique({
    where: { externalKey },
    select: { id: true },
  })
  if (existing) {
    return {
      ok: true,
      duplicate: true,
      leadId: existing.id,
      publisherNumber,
      offerId: offer.id,
      payout,
    }
  }

  try {
    const lead = await prisma.conversionLead.create({
      data: {
        userId: publisher.id,
        postbackId: config.id,
        offerId: offer.id,
        campaignId: offer.id,
        campaignName: offer.name,
        payout,
        country: countryCode || null,
        ipAddress: ip || null,
        status: 'Approved',
        sub1: s1,
        sub2: s2,
        sub3: s3 || null,
        sub4: s4 || null,
        occurredAt,
        externalKey,
      },
      select: {
        id: true,
        offerId: true,
        campaignId: true,
        campaignName: true,
        payout: true,
        country: true,
        ipAddress: true,
        status: true,
        sub3: true,
        sub4: true,
        occurredAt: true,
        createdAt: true,
      },
    })

    // Crack Bounty: credit then fire publisher Global S2S with full conversion tokens.
    let publisherPostback: { fired: boolean; status?: number; skipped?: string; url?: string } | undefined
    try {
      const { firePublisherGlobalPostback } = await import('@/lib/publisher-postback')
      publisherPostback = await firePublisherGlobalPostback(publisher.id, {
        ...lead,
      })
    } catch (error) {
      console.error('Publisher postback dispatch failed:', error)
      publisherPostback = { fired: false, skipped: 'dispatch_error' }
    }

    return {
      ok: true,
      leadId: lead.id,
      publisherNumber,
      offerId: offer.id,
      payout,
      publisherPostback,
    }
  } catch (error: unknown) {
    const code = typeof error === 'object' && error && 'code' in error
      ? String((error as { code?: string }).code)
      : ''
    if (code === 'P2002') {
      const raced = await prisma.conversionLead.findUnique({
        where: { externalKey },
        select: { id: true },
      })
      if (raced) {
        return {
          ok: true,
          duplicate: true,
          leadId: raced.id,
          publisherNumber,
          offerId: offer.id,
          payout,
        }
      }
    }
    throw error
  }
}

export async function sumPublisherEarnings(userId: string): Promise<number> {
  const aggregate = await prisma.conversionLead.aggregate({
    where: { userId, publisherInvoiceId: null },
    _sum: { payout: true },
  })
  return Number(aggregate._sum.payout ?? 0)
}
