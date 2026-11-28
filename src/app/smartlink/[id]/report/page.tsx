import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  CircleDollarSign,
  MousePointer2,
  ShoppingCart,
} from 'lucide-react'
import * as CountryFlags from 'country-flag-icons/react/1x1'
import { prisma } from '@/lib/db/prisma'
import { offerGeoCountryCode } from '@/lib/offer-geo'
import { PUBLISHER_SMARTLINK_KIND } from '@/lib/smartlink'
import { ensurePublisherSmartlinkSubId } from '@/lib/smartlink-subid'
import dashboardStyles from '@/components/dashboard/Dashboard.module.css'
import { allTimeReportPreset, reportRangePresets } from '@/lib/report-date-presets'
import SmartlinkReportDateFilter from './SmartlinkReportDateFilter'
import SmartlinkCopyButton from './SmartlinkCopyButton'
import styles from './SmartlinkReport.module.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Smartlink Geo Report | Crack Bounty',
  robots: { index: false, follow: false },
}

type SmartlinkReportPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function parseReportDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date
}

export default async function SmartlinkReportPage({ params, searchParams }: SmartlinkReportPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    notFound()
  }

  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const requestedFrom = firstSearchParam(query.from)
  const requestedTo = firstSearchParam(query.to)
  const parsedFrom = parseReportDate(requestedFrom)
  const parsedTo = parseReportDate(requestedTo)
  const hasValidRange = Boolean(parsedFrom && parsedTo && parsedFrom <= parsedTo)
  const requestedPreset = firstSearchParam(query.preset)
  const isAllTime = firstSearchParam(query.allTime) === '1' || requestedPreset === allTimeReportPreset.label
  const startDate = hasValidRange ? requestedFrom! : today
  const endDate = hasValidRange ? requestedTo! : today
  const presetLabels = new Set([
    allTimeReportPreset.label,
    ...reportRangePresets.map((preset) => preset.label),
    'Custom Range',
  ])
  const presetLabel = isAllTime
    ? allTimeReportPreset.label
    : hasValidRange
      ? requestedPreset && presetLabels.has(requestedPreset) ? requestedPreset : 'Custom Range'
      : 'Today'
  const reportDateFilter = (() => {
    if (isAllTime) return null
    const lt = new Date(`${endDate}T00:00:00.000Z`)
    lt.setUTCDate(lt.getUTCDate() + 1)
    return {
      gte: new Date(`${startDate}T00:00:00.000Z`),
      lt,
    }
  })()
  const searchTerm = (firstSearchParam(query.q) || '').trim().toLowerCase()

  const smartlink = await prisma.incentiveTool.findFirst({
    where: { id, kind: PUBLISHER_SMARTLINK_KIND, isPublished: true },
    select: { name: true, ownerId: true, publisherSubId: true },
  })
  if (!smartlink) notFound()

  const publisherSubId = await ensurePublisherSmartlinkSubId(id, smartlink.publisherSubId)
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const todayLeadsPromise = publisherSubId
    ? prisma.conversionLead.findMany({
        where: {
          userId: smartlink.ownerId,
          sub3: publisherSubId,
          OR: [{ status: { not: 'Reversed' } }, { status: null }],
          createdAt: { gte: todayStart },
        },
        select: { createdAt: true, payout: true },
      })
    : Promise.resolve([])
  const monthRevenuePromise = publisherSubId
    ? prisma.conversionLead.aggregate({
        where: {
          userId: smartlink.ownerId,
          sub3: publisherSubId,
          OR: [{ status: { not: 'Reversed' } }, { status: null }],
          createdAt: { gte: monthStart },
        },
        _sum: { payout: true },
      })
    : Promise.resolve(null)
  const [clickGroups, leads, todayClicks, todayLeads, monthRevenueResult] = await Promise.all([
    prisma.offerClick.groupBy({
      by: ['countryCode'],
      where: {
        smartlinkId: id,
        isUnique: true,
        ...(reportDateFilter ? { createdAt: reportDateFilter } : {}),
      },
      _count: { _all: true },
    }),
    publisherSubId
      ? prisma.conversionLead.findMany({
          where: {
            userId: smartlink.ownerId,
            sub3: publisherSubId,
            OR: [{ status: { not: 'Reversed' } }, { status: null }],
            ...(reportDateFilter ? { createdAt: reportDateFilter } : {}),
          },
          select: { offerId: true, payout: true },
        })
      : Promise.resolve([]),
    prisma.offerClick.findMany({
      where: {
        smartlinkId: id,
        isUnique: true,
        createdAt: { gte: todayStart },
      },
      select: { createdAt: true },
    }),
    todayLeadsPromise,
    monthRevenuePromise,
  ])
  const hourlyPerformance = Array.from({ length: 24 }, () => ({
    clicks: 0,
    conversions: 0,
    revenue: 0,
  }))
  for (const click of todayClicks) {
    hourlyPerformance[click.createdAt.getUTCHours()].clicks += 1
  }
  for (const lead of todayLeads) {
    const hour = lead.createdAt.getUTCHours()
    hourlyPerformance[hour].conversions += 1
    hourlyPerformance[hour].revenue += Number(lead.payout ?? 0)
  }
  const todayRevenue = todayLeads.reduce((total, lead) => total + Number(lead.payout ?? 0), 0)
  const todayConversions = todayLeads.length
  const todayClickCount = todayClicks.length
  const todayEpc = todayClickCount > 0 ? todayRevenue / todayClickCount : 0
  const todayConversionRate = todayClickCount > 0
    ? (todayConversions / todayClickCount) * 100
    : (todayConversions > 0 ? 100 : 0)
  const monthRevenue = Number(monthRevenueResult?._sum.payout ?? 0)
  const maxHourlyValue = Math.max(
    1,
    ...hourlyPerformance.map((hour) => hour.clicks),
    ...hourlyPerformance.map((hour) => hour.conversions),
    ...hourlyPerformance.map((hour) => hour.revenue),
  )
  const chartY = (value: number) => 210 - (value / maxHourlyValue) * 200
  const chartPoints = (key: 'clicks' | 'conversions' | 'revenue') => hourlyPerformance
    .map((hour, index) => `${36 + index * 19.2},${chartY(hour[key])}`)
    .join(' ')
  const offerIds = [...new Set(leads.map((lead) => lead.offerId).filter((offerId): offerId is string => Boolean(offerId)))]
  const offers = offerIds.length
    ? await prisma.campaignOffer.findMany({
        where: { id: { in: offerIds } },
        select: { id: true, country: true, countries: true },
      })
    : []
  const offersById = new Map(offers.map((offer) => [offer.id, offer]))
  const countryNames = new Intl.DisplayNames(['en'], { type: 'region' })

  type CountryBucket = {
    code: string
    label: string
    revenue: number
    clicks: number
    leads: number
  }
  const buckets = new Map<string, CountryBucket>()
  const ensureBucket = (value: string | null | undefined) => {
    const candidate = String(value || '').trim().toUpperCase()
    const code = /^[A-Z]{2}$/.test(candidate) && candidate !== 'XX' ? candidate : 'XX'
    const existing = buckets.get(code)
    if (existing) return existing
    const bucket = {
      code,
      label: code === 'XX' ? 'Unknown' : countryNames.of(code) || code,
      revenue: 0,
      clicks: 0,
      leads: 0,
    }
    buckets.set(code, bucket)
    return bucket
  }

  for (const group of clickGroups) {
    ensureBucket(group.countryCode).clicks += group._count._all
  }

  for (const lead of leads) {
    const offer = offersById.get(lead.offerId || '')
    const country = offer ? offerGeoCountryCode(offer) || 'XX' : 'XX'
    const bucket = ensureBucket(country)
    bucket.leads += 1
    bucket.revenue += Number(lead.payout ?? 0)
  }

  const rows = [...buckets.values()]
    .map((bucket) => ({
      ...bucket,
      epc: bucket.clicks > 0 ? bucket.revenue / bucket.clicks : 0,
      cr: bucket.clicks > 0 ? (bucket.leads / bucket.clicks) * 100 : (bucket.leads > 0 ? 100 : 0),
    }))
    .sort((left, right) => right.revenue - left.revenue || right.leads - left.leads || left.label.localeCompare(right.label))
  const totals = rows.reduce(
    (total, row) => ({
      revenue: total.revenue + row.revenue,
      clicks: total.clicks + row.clicks,
      leads: total.leads + row.leads,
    }),
    { revenue: 0, clicks: 0, leads: 0 },
  )
  const totalEpc = totals.clicks > 0 ? totals.revenue / totals.clicks : 0
  const totalCr = totals.clicks > 0 ? (totals.leads / totals.clicks) * 100 : (totals.leads > 0 ? 100 : 0)
  const visibleRows = searchTerm
    ? rows.filter((row) => `${row.label} ${row.code}`.toLowerCase().includes(searchTerm))
    : rows
  const formatMoney = (value: number) => `$${value.toFixed(2)}`
  const formatStatMoney = (value: number) => `$${value.toFixed(value >= 100 || Number.isInteger(value) ? 0 : 2)}`
  const formatCr = (value: number) => {
    const rounded = Math.round(value * 100) / 100
    return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(2)}%`
  }

  return (
    <main className={styles.publicReportMain}>
      <header className={dashboardStyles.pageHeader}>
        <h1>Geo Reports</h1>
        <div className={dashboardStyles.pageHeaderRight}>
          <SmartlinkReportDateFilter
            startDate={startDate}
            endDate={endDate}
            presetLabel={presetLabel}
          />
          <SmartlinkCopyButton smartlinkId={id} smartlinkName={smartlink.name} />
        </div>
      </header>
      <div className={`${dashboardStyles.dashboardGrid} ${styles.reportAnalytics}`}>
        <section className={`${dashboardStyles.panel} ${dashboardStyles.performancePanel}`}>
          <h2><span className={dashboardStyles.titleIcon}>ϟ</span> TODAY PERFORMANCE</h2>
          <div className={dashboardStyles.chartWrap}>
            <div className={dashboardStyles.yLabels}>
              {['1.0', '0.9', '0.8', '0.7', '0.6', '0.5', '0.4', '0.3', '0.2', '0.1', '0'].map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
            <div className={dashboardStyles.chart}>
              <div className={dashboardStyles.chartGrid} />
              <svg
                viewBox="0 0 480 224"
                preserveAspectRatio="none"
                role="img"
                aria-label="Today's hourly clicks, conversions, and revenue for this Smartlink"
              >
                <polyline points={chartPoints('revenue')} fill="none" stroke="#3d464d" strokeWidth="3" vectorEffect="non-scaling-stroke" />
                <polyline points={chartPoints('clicks')} fill="none" stroke="#3498db" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                <polyline points={chartPoints('conversions')} fill="none" stroke="#60ed32" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                {hourlyPerformance.map((hour, index) => (
                  <circle key={`revenue-${index}`} cx={36 + index * 19.2} cy={chartY(hour.revenue)} r="3" fill="#3d464d" />
                ))}
                {hourlyPerformance.map((hour, index) => (
                  <circle key={`clicks-${index}`} cx={36 + index * 19.2} cy={chartY(hour.clicks)} r="2.5" fill="#3498db" />
                ))}
                {hourlyPerformance.map((hour, index) => (
                  <circle key={`conversions-${index}`} cx={36 + index * 19.2} cy={chartY(hour.conversions)} r="2.5" fill="#60ed32" />
                ))}
              </svg>
              <div className={dashboardStyles.xLabels}>
                {Array.from({ length: 24 }, (_, hour) => <span key={hour}>{hour}</span>)}
              </div>
            </div>
          </div>
          <div className={dashboardStyles.legend}>
            <span><i className={dashboardStyles.legendClicks} />Clicks</span>
            <span><i className={dashboardStyles.legendConversions} />Conversions</span>
            <span><i className={dashboardStyles.legendRevenue} />Revenue</span>
          </div>
        </section>
        <section className={`${dashboardStyles.panel} ${dashboardStyles.statsPanel}`} aria-label="Today's Smartlink statistics">
          <div><p><CircleDollarSign size={15} aria-hidden="true" />Revenue</p><strong>{formatStatMoney(todayRevenue)}</strong></div>
          <div><p><ShoppingCart size={15} aria-hidden="true" />Conversions</p><strong>{todayConversions}</strong></div>
          <div><p><MousePointer2 size={15} aria-hidden="true" />Clicks</p><strong>{todayClickCount}</strong></div>
          <div><p><BriefcaseBusiness size={15} aria-hidden="true" />Avg. EPC</p><strong>{formatStatMoney(todayEpc)}</strong></div>
          <div>
            <p><BarChart3 size={15} aria-hidden="true" />Conv. Rate</p>
            <strong className={dashboardStyles.successValue}>
              {todayConversionRate.toFixed(todayConversionRate % 1 ? 2 : 0)}<small>%</small>
            </strong>
          </div>
          <div><p><CalendarDays size={15} aria-hidden="true" />This Month</p><strong>${monthRevenue.toFixed(2)}</strong></div>
        </section>
      </div>
      <section className={`${dashboardStyles.panel} ${dashboardStyles.dataPage} ${dashboardStyles.reportPanel}`}>
        <div className={dashboardStyles.reportHeading}>
          <h2><BarChart3 aria-hidden="true" /> Geo Reports</h2>
          <form method="get" className={dashboardStyles.reportTools}>
            {isAllTime ? (
              <input type="hidden" name="allTime" value="1" />
            ) : (
              <>
                <input type="hidden" name="from" value={startDate} />
                <input type="hidden" name="to" value={endDate} />
                <input type="hidden" name="preset" value={presetLabel} />
              </>
            )}
            <input
              id="table_search"
              type="text"
              className="table_search"
              aria-label="Search"
              placeholder="Search"
              name="q"
              defaultValue={firstSearchParam(query.q) || ''}
            />
          </form>
        </div>
        <div className={dashboardStyles.reportBody}>
          <div className={dashboardStyles.reportTableWrap}>
            <table className={`${dashboardStyles.dataTable} ${dashboardStyles.displayTable}`}>
              <thead>
                <tr>
                  <th scope="col">Country</th>
                  <th scope="col">Revenue</th>
                  <th scope="col">Clicks</th>
                  <th scope="col">Leads</th>
                  <th scope="col">EPC</th>
                  <th scope="col">CR</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length ? visibleRows.map((row, index) => {
                  const Flag = row.code === 'XX'
                    ? null
                    : CountryFlags[row.code as keyof typeof CountryFlags]
                  return (
                    <tr className={index % 2 === 0 ? dashboardStyles.rowOdd : dashboardStyles.rowEven} key={row.code}>
                      <td className={dashboardStyles.reportCampaignCell}>
                        {Flag ? <Flag className={styles.countryFlag} aria-label={row.label} title={row.label} /> : null}
                        {row.label}
                      </td>
                      <td>{formatMoney(row.revenue)}</td>
                      <td>{row.clicks}</td>
                      <td>{row.leads}</td>
                      <td>{formatMoney(row.epc)}</td>
                      <td>{formatCr(row.cr)}</td>
                    </tr>
                  )
                }) : (
                  <tr className={dashboardStyles.dataEmpty}>
                    <td className={dashboardStyles.dataTablesEmpty} colSpan={6}>No data available</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className={dashboardStyles.dataTotal}>
                  <th scope="row">Total</th>
                  <th>{formatMoney(totals.revenue)}</th>
                  <th>{totals.clicks}</th>
                  <th>{totals.leads}</th>
                  <th>{formatMoney(totalEpc)}</th>
                  <th>{formatCr(totalCr)}</th>
                </tr>
              </tfoot>
            </table>
            <div className={dashboardStyles.reportPagination}>
              <div className={dashboardStyles.reportPaginationInfo}>
                Showing {visibleRows.length ? 1 : 0} to {visibleRows.length} of {visibleRows.length} entries
              </div>
              <div className={dashboardStyles.reportPaginationControls}>
                <button type="button" disabled>Previous</button>
                <button type="button" className={dashboardStyles.campaignPageActive}>1</button>
                <button type="button" disabled>Next</button>
              </div>
            </div>
          </div>
        </div>
      </section>
      <p className={styles.publicReportNote}>Report for {smartlink.name} · Clicks are unique</p>
    </main>
  )
}
