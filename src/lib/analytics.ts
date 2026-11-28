import { prisma } from '@/lib/db/prisma'
import { lookupCountryCode } from '@/lib/ip2location'
import { isCreditedConversionStatus } from '@/lib/conversion-reversal'
import { offerGeoCountryCode } from '@/lib/offer-geo'
import { buildOfferClickDuplicateWhere } from '@/lib/offer-click-dedupe'

export type AnalyticsScope = {
  role: 'MANAGER' | 'PUBLISHER'
  userId: string
  publisherNumber?: number | null
}

function startOfDayUtc(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0))
}

function startOfMonthUtc(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0))
}

function daysAgoUtc(days: number, from = new Date()) {
  const start = startOfDayUtc(from)
  start.setUTCDate(start.getUTCDate() - days)
  return start
}

function leadWhere(scope: AnalyticsScope, from?: Date, to?: Date, includeReversed = false) {
  const where: Record<string, unknown> = {}
  if (scope.role === 'PUBLISHER') where.userId = scope.userId
  if (!includeReversed) {
    where.OR = [{ status: { not: 'Reversed' } }, { status: null }]
  }
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lt: to } : {}),
    }
  }
  return where
}

function clickWhere(scope: AnalyticsScope, from?: Date, to?: Date) {
  const where: Record<string, unknown> = { isUnique: true }
  if (scope.role === 'PUBLISHER') {
    if (scope.publisherNumber != null) where.publisherNumber = scope.publisherNumber
    else where.publisherUserId = scope.userId
  }
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lt: to } : {}),
    }
  }
  return where
}

function subIdReportParts(first: string | null) {
  const subId1 = (first || '').trim()
  return {
    key: JSON.stringify([subId1]),
    label: subId1 || '(none)',
  }
}

function usableCountryCode(country: string | null | undefined): string {
  const code = String(country || '').trim().toUpperCase()
  return /^[A-Z]{2}$/.test(code) ? code : ''
}

export async function getOverviewStats(scope: AnalyticsScope) {
  const todayStart = startOfDayUtc()
  const monthStart = startOfMonthUtc()

  const [todayAgg, monthAgg, todayClicks, recentLeads, hourlyLeads, hourlyClicks, campaignOffers] = await Promise.all([
    prisma.conversionLead.aggregate({
      where: leadWhere(scope, todayStart),
      _sum: { payout: true },
      _count: { _all: true },
    }),
    prisma.conversionLead.aggregate({
      where: leadWhere(scope, monthStart),
      _sum: { payout: true },
    }),
    prisma.offerClick.count({
      where: clickWhere(scope, todayStart),
    }),
    prisma.conversionLead.findMany({
      where: leadWhere(scope),
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: {
        id: true,
        offerId: true,
        campaignName: true,
        payout: true,
        status: true,
        sub1: true,
        sub2: true,
        sub3: true,
        sub4: true,
        createdAt: true,
        occurredAt: true,
      },
    }),
    prisma.conversionLead.findMany({
      where: leadWhere(scope, todayStart),
      select: { createdAt: true, payout: true },
    }),
    prisma.offerClick.findMany({
      where: clickWhere(scope, todayStart),
      select: { createdAt: true },
    }),
    prisma.campaignOffer.findMany({
      select: { id: true, country: true, countries: true },
    }),
  ])

  const revenue = Number(todayAgg._sum.payout ?? 0)
  const conversions = todayAgg._count._all
  const clicks = todayClicks
  const epc = clicks > 0 ? revenue / clicks : 0
  const convRate = clicks > 0 ? (conversions / clicks) * 100 : (conversions > 0 ? 100 : 0)
  const monthRevenue = Number(monthAgg._sum.payout ?? 0)

  const hourly = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    clicks: 0,
    conversions: 0,
    revenue: 0,
  }))

  for (const click of hourlyClicks) {
    hourly[click.createdAt.getUTCHours()].clicks += 1
  }
  for (const lead of hourlyLeads) {
    const hour = lead.createdAt.getUTCHours()
    hourly[hour].conversions += 1
    hourly[hour].revenue += Number(lead.payout ?? 0)
  }

  const campaignCountries = new Map(
    campaignOffers.map((offer) => [
      offer.id,
      offerGeoCountryCode(offer) || '',
    ]),
  )

  return {
    today: {
      revenue,
      conversions,
      clicks,
      avgEpc: epc,
      convRate,
      monthRevenue,
    },
    hourly,
    recentConversions: recentLeads.map((lead) => {
      const offerId = lead.offerId || ''
      const cleaned = (lead.campaignName || '').replace(/\s*\(#\d+\)\s*$/, '').trim()
      const campaign = offerId && /^\d+$/.test(offerId)
        ? (!cleaned || cleaned === `#${offerId}` ? `#${offerId}` : `${cleaned} (#${offerId})`)
        : (cleaned || lead.campaignName || 'Unknown')
      return {
        id: lead.id,
        offerId: lead.offerId,
        campaign,
        payout: Number(lead.payout ?? 0),
        country: campaignCountries.get(lead.offerId || '') || '—',
        subId: lead.sub3 || '—',
        createdAt: (lead.occurredAt || lead.createdAt).toISOString(),
        status: lead.status || 'Approved',
      }
    }),
  }
}

export async function getReportData(
  scope: AnalyticsScope,
  type: 'daily' | 'campaign' | 'geo' | 'subid' | 'conversions' | 'tool',
  range?: { from?: string | null; to?: string | null; allTime?: boolean },
) {
  const from = range?.allTime
    ? undefined
    : range?.from
      ? new Date(`${range.from}T00:00:00.000Z`)
      : type === 'daily'
        ? daysAgoUtc(29)
        : startOfDayUtc()
  const toExclusive = range?.allTime
    ? null
    : range?.to
      ? new Date(`${range.to}T00:00:00.000Z`)
      : null
  if (toExclusive) toExclusive.setUTCDate(toExclusive.getUTCDate() + 1)

  const reportDateFilter = {
    ...(from ? { gte: from } : {}),
    ...(toExclusive ? { lt: toExclusive } : {}),
  }
  const reportLeadWhere = type === 'conversions' && (from || toExclusive)
    ? {
        ...leadWhere(scope, undefined, undefined, true),
        OR: [
          { occurredAt: reportDateFilter },
          { occurredAt: null, createdAt: reportDateFilter },
        ],
      }
    : leadWhere(scope, from, toExclusive || undefined, type === 'conversions')

  const leads = await prisma.conversionLead.findMany({
    where: reportLeadWhere,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      offerId: true,
      campaignName: true,
      payout: true,
      country: true,
      status: true,
      sub1: true,
      sub2: true,
      sub3: true,
      sub4: true,
      ipAddress: true,
      createdAt: true,
      occurredAt: true,
    },
  })
  const clicks = await prisma.offerClick.findMany({
    where: clickWhere(scope, from, toExclusive || undefined),
    select: {
      offerId: true,
      sub1: true,
      sub2: true,
      countryCode: true,
      createdAt: true,
    },
  })

  if (type === 'conversions') {
    const offerIds = [...new Set(
      leads
        .map((lead) => lead.offerId)
        .filter((offerId): offerId is string => Boolean(offerId)),
    )]
    const campaignOffers = await prisma.campaignOffer.findMany({
      where: { id: { in: offerIds } },
      select: { id: true, country: true, countries: true },
    })
    const campaignCountries = new Map(
      campaignOffers.map((offer) => [
        offer.id,
        offerGeoCountryCode(offer),
      ]),
    )
    const formatConversionCampaign = (name: string, offerId: string) => {
      const cleaned = (name || '').replace(/\s*\(#\d+\)\s*$/, '').trim()
      if (offerId && /^\d+$/.test(offerId)) {
        if (!cleaned || cleaned === `#${offerId}`) return `#${offerId}`
        return `${cleaned} (#${offerId})`
      }
      return cleaned || name || 'Unknown'
    }
    return {
      type,
      rows: leads.map((lead) => ({
        id: lead.id,
        offerId: lead.offerId || '',
        campaign: formatConversionCampaign(lead.campaignName || '', lead.offerId || ''),
        country: campaignCountries.get(lead.offerId || '') || '—',
        // Publisher SubIDs 1 and 2 arrive as inbound postback s3 and s4.
        subId: lead.sub3 || '—',
        subId2: lead.sub4 || '—',
        revenue: lead.status?.trim().toLowerCase() === 'reversed' ? 0 : Number(lead.payout ?? 0),
        ip: lead.ipAddress || '—',
        status: isCreditedConversionStatus(lead.status) ? 'Credited' : lead.status || 'Credited',
        date: (lead.occurredAt || lead.createdAt).toISOString(),
      })),
      totals: null,
      chartLabels: [],
      chartClicks: [],
      chartConversions: [],
      chartRevenue: [],
    }
  }

  if (type === 'tool') {
    return {
      type,
      rows: [] as Array<Record<string, string | number>>,
      totals: { revenue: 0, clicks: 0, leads: 0, epc: 0, cr: 0 },
      chartLabels: [],
      chartClicks: [],
      chartConversions: [],
      chartRevenue: [],
    }
  }

  type Bucket = {
    key: string
    label: string
    revenue: number
    clicks: number
    leads: number
    countryCounts: Map<string, number>
  }
  const buckets = new Map<string, Bucket>()

  const ensure = (key: string, label: string) => {
    const existing = buckets.get(key)
    if (existing) {
      if (label && label !== existing.label && !label.startsWith('#') && existing.label.startsWith('#')) {
        existing.label = label
      }
      return existing
    }
    const created = { key, label, revenue: 0, clicks: 0, leads: 0, countryCounts: new Map<string, number>() }
    buckets.set(key, created)
    return created
  }

  const dayKey = (date: Date) => date.toISOString().slice(0, 10)

  const countryDisplayNames = new Intl.DisplayNames(['en'], { type: 'region' })
  const countryLabel = (code: string) => {
    if (code === 'XX') return 'Unknown'
    if (!/^[A-Z]{2}$/.test(code)) return code
    return countryDisplayNames.of(code) || code
  }

  // Offer details provide campaign labels and the lead geo report's target geo.
  const offerById = new Map<string, { name: string; country: string; countries: string[] }>()
  if (type === 'campaign' || type === 'geo') {
    const offerIds = [
      ...new Set([
        ...clicks.map((click) => click.offerId).filter(Boolean),
        ...leads.map((lead) => lead.offerId || '').filter(Boolean),
      ]),
    ]
    if (offerIds.length) {
      const offers = await prisma.campaignOffer.findMany({
        where: { id: { in: offerIds } },
        select: { id: true, name: true, country: true, countries: true },
      })
      for (const offer of offers) {
        offerById.set(offer.id, {
          name: offer.name,
          country: offer.country,
          countries: offer.countries || [],
        })
      }
    }
  }

  for (const click of clicks) {
    if (type === 'daily') {
      const key = dayKey(click.createdAt)
      ensure(key, key).clicks += 1
    } else if (type === 'campaign') {
      const key = click.offerId || 'unknown'
      ensure(key, `#${key}`).clicks += 1
    } else if (type === 'subid') {
      const { key, label } = subIdReportParts(click.sub1)
      ensure(key, label).clicks += 1
    } else if (type === 'geo') {
      const key = (click.countryCode || 'XX').toUpperCase()
      ensure(key, countryLabel(key)).clicks += 1
    }
  }

  for (const lead of leads) {
    if (type === 'daily') {
      const key = dayKey(lead.createdAt)
      const bucket = ensure(key, key)
      bucket.leads += 1
      bucket.revenue += Number(lead.payout ?? 0)
    } else if (type === 'campaign') {
      const key = lead.offerId || 'unknown'
      const bucket = ensure(key, lead.campaignName || `#${key}`)
      bucket.leads += 1
      bucket.revenue += Number(lead.payout ?? 0)
      const country = (lead.country || '').toUpperCase()
      if (country && country !== '—' && country !== 'XX') {
        bucket.countryCounts.set(country, (bucket.countryCounts.get(country) || 0) + 1)
      }
    } else if (type === 'geo') {
      const offer = offerById.get(lead.offerId || '')
      const key = usableCountryCode(offer?.country)
        || usableCountryCode(offer?.countries[0])
        || 'XX'
      const bucket = ensure(key, countryLabel(key))
      bucket.leads += 1
      bucket.revenue += Number(lead.payout ?? 0)
    } else if (type === 'subid') {
      const { key, label } = subIdReportParts(lead.sub3)
      const bucket = ensure(key, label)
      bucket.leads += 1
      bucket.revenue += Number(lead.payout ?? 0)
    }
  }

  const topCountry = (counts: Map<string, number>) => {
    let best = ''
    let bestCount = 0
    for (const [code, count] of counts) {
      if (count > bestCount) {
        best = code
        bestCount = count
      }
    }
    return best
  }

  const formatCampaignLabel = (name: string, id: string) => {
    const cleaned = name.replace(/\s*\(#\d+\)\s*$/, '').trim()
    if (!cleaned || cleaned === `#${id}`) return `#${id}`
    if (/^\d+$/.test(id)) return `${cleaned} (#${id})`
    return cleaned
  }

  const rows = [...buckets.values()]
    .sort((a, b) => b.revenue - a.revenue || b.leads - a.leads || a.label.localeCompare(b.label))
    .map((bucket) => {
      const epc = bucket.clicks > 0 ? bucket.revenue / bucket.clicks : 0
      const cr = bucket.clicks > 0 ? (bucket.leads / bucket.clicks) * 100 : (bucket.leads > 0 ? 100 : 0)
      const offer = type === 'campaign' ? offerById.get(bucket.key) : undefined
      const country = type === 'campaign'
        ? (offer?.country || offer?.countries?.[0] || topCountry(bucket.countryCounts) || '')
        : type === 'geo'
          ? bucket.key
          : ''
      const label = type === 'campaign'
        ? formatCampaignLabel(offer?.name || bucket.label, bucket.key)
        : type === 'geo'
          ? countryLabel(bucket.key)
          : bucket.label
      return {
        key: bucket.key,
        offerId: type === 'campaign' ? bucket.key : '',
        label,
        country: country.toUpperCase(),
        revenue: bucket.revenue,
        clicks: bucket.clicks,
        leads: bucket.leads,
        epc,
        cr,
      }
    })

  const totals = rows.reduce(
    (acc, row) => {
      acc.revenue += row.revenue
      acc.clicks += row.clicks
      acc.leads += row.leads
      return acc
    },
    { revenue: 0, clicks: 0, leads: 0, epc: 0, cr: 0 },
  )
  totals.epc = totals.clicks > 0 ? totals.revenue / totals.clicks : 0
  totals.cr = totals.clicks > 0 ? (totals.leads / totals.clicks) * 100 : (totals.leads > 0 ? 100 : 0)

  // Chart spans the selected report range (Crack Bounty Chart.js axis)
  const chartEnd = range?.to
    ? new Date(`${range.to}T00:00:00.000Z`)
    : startOfDayUtc()
  const chartStartDate = from || chartEnd
  const chartStart = new Date(Date.UTC(chartStartDate.getUTCFullYear(), chartStartDate.getUTCMonth(), chartStartDate.getUTCDate()))
  const dayCount = Math.max(
    1,
    Math.floor((chartEnd.getTime() - chartStart.getTime()) / 86400000) + 1,
  )
  const dailyChart = new Map<string, { clicks: number; leads: number; revenue: number }>()
  for (let i = 0; i < dayCount; i += 1) {
    const day = new Date(chartStart.getTime())
    day.setUTCDate(chartStart.getUTCDate() + i)
    dailyChart.set(dayKey(day), { clicks: 0, leads: 0, revenue: 0 })
  }
  for (const click of clicks) {
    const key = dayKey(click.createdAt)
    const bucket = dailyChart.get(key)
    if (bucket) bucket.clicks += 1
  }
  for (const lead of leads) {
    const key = dayKey(lead.createdAt)
    const bucket = dailyChart.get(key)
    if (bucket) {
      bucket.leads += 1
      bucket.revenue += Number(lead.payout ?? 0)
    }
  }
  const chartLabels: string[] = []
  const chartClicks: number[] = []
  const chartConversions: number[] = []
  const chartRevenue: number[] = []
  for (let i = 0; i < dayCount; i += 1) {
    const day = new Date(chartStart.getTime())
    day.setUTCDate(chartStart.getUTCDate() + i)
    const key = dayKey(day)
    // Crack Bounty daily chart axis: DD/MM/YYYY
    chartLabels.push(`${String(day.getUTCDate()).padStart(2, '0')}/${String(day.getUTCMonth() + 1).padStart(2, '0')}/${day.getUTCFullYear()}`)
    const bucket = dailyChart.get(key)
    chartClicks.push(bucket?.clicks ?? 0)
    chartConversions.push(bucket?.leads ?? 0)
    chartRevenue.push(bucket?.revenue ?? 0)
  }

  return { type, rows, totals, chartLabels, chartClicks, chartConversions, chartRevenue }
}

export async function recordOfferClick(input: {
  publisherNumber: number
  publisherUserId?: string | null
  offerId: string
  sub1?: string
  sub2?: string
  ipAddress?: string | null
  userAgent?: string | null
  countryCode?: string | null
  smartlinkId?: string | null
  smartlinkVisitorHash?: string | null
  useProviderIpFallback?: boolean
}) {
  const ipAddress = input.ipAddress?.trim() || null
  const userAgent = input.userAgent?.trim() || null
  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const duplicateWhere = buildOfferClickDuplicateWhere({
    publisherNumber: input.publisherNumber,
    offerId: input.offerId,
    smartlinkId: input.smartlinkId,
    ipAddress,
    userAgent,
    windowStart,
  })

  const click = await prisma.$transaction(async (transaction) => {
    const lockKey = input.smartlinkId && input.smartlinkVisitorHash
      ? `smartlink:${input.smartlinkId}:${input.smartlinkVisitorHash}`
      : `offer:${input.offerId}`
    await transaction.$queryRaw<Array<{ locked: boolean }>>`
      SELECT TRUE AS locked
      FROM pg_advisory_xact_lock(CAST(${input.publisherNumber} AS INTEGER), hashtext(${lockKey}))
    `

    const duplicate = duplicateWhere
      ? await transaction.offerClick.findFirst({
          where: duplicateWhere,
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: { countryCode: true },
        })
      : null

    return transaction.offerClick.create({
      data: {
        publisherNumber: input.publisherNumber,
        publisherUserId: input.publisherUserId || null,
        offerId: input.offerId,
        sub1: input.sub1 || null,
        sub2: input.sub2 || null,
        ipAddress,
        countryCode: duplicate?.countryCode || null,
        userAgent,
        smartlinkId: input.smartlinkId || null,
        isUnique: !duplicate,
      },
    })
  })

  if (!click.isUnique) return click

  const countryCode = input.countryCode !== undefined
    ? input.countryCode
    : await lookupCountryCode(ipAddress, {
        useProviderIpFallback: input.useProviderIpFallback,
      })
  if (!countryCode) return click

  return prisma.offerClick.update({
    where: { id: click.id },
    data: { countryCode },
  })
}
