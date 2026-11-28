import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BarChart3 } from 'lucide-react'
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

  const today = new Date().toISOString().slice(0, 10)
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
  const [clickGroups, leads] = await Promise.all([
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
  ])
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
