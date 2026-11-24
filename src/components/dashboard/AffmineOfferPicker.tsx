'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import * as CountryFlags from 'country-flag-icons/react/1x1'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import type { AffmineOffer } from '@/lib/affmine'
import styles from './AffmineOfferPicker.module.css'
import dashboardStyles from './Dashboard.module.css'

type Props = {
  existingOfferIds: string[]
  sidebarHidden: boolean
  onClose: () => void
  onImport: (offer: AffmineOffer) => void
}

type SortKey = 'id' | 'name' | 'payout'
type DeviceFilter = 'All' | 'Windows' | 'Mac' | 'Android' | 'iPhone' | 'iPad' | 'Mobile (Other)'

const pageSizes = [25, 50, 100]
const allOfferDevices: DeviceFilter[] = ['Windows', 'Mac', 'Android', 'iPhone', 'iPad', 'Mobile (Other)']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isAffmineOffer(value: unknown): value is AffmineOffer {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && (typeof value.payout === 'number' || value.payout === null)
    && typeof value.currency === 'string'
    && typeof value.previewUrl === 'string'
    && typeof value.trackingUrl === 'string'
    && typeof value.category === 'string'
    && Array.isArray(value.countries)
    && value.countries.every((country) => typeof country === 'string')
    && typeof value.description === 'string'
    && typeof value.incentive === 'boolean'
}

function offerTypes(offer: AffmineOffer): string[] {
  const words = `${offer.name} ${offer.category}`.toUpperCase().split(/[^A-Z0-9]+/)
  const types = ['CPL', 'CPE', 'CPI', 'SOI', 'DOI'].filter((type) => words.includes(type))
  return types.length ? types : [offer.incentive ? 'CPI' : 'CPL']
}

function countryName(code: string): string {
  if (code === 'GB') return 'United Kingdom'
  return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code
}

export default function AffmineOfferPicker({ existingOfferIds, sidebarHidden, onClose, onImport }: Props) {
  const [offers, setOffers] = useState<AffmineOffer[]>([])
  const [search, setSearch] = useState('')
  const [country, setCountry] = useState('All')
  const [device, setDevice] = useState<DeviceFilter>('All')
  const [category, setCategory] = useState('All')
  const [type, setType] = useState('All')
  const [sortKey, setSortKey] = useState<SortKey>('id')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const loadOffers = async () => {
      setLoading(true)
      setError('')
      try {
        const response = await fetch('/api/integrations/affmine/offers', {
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        })
        const result: unknown = await response.json()
        if (!response.ok) {
          const message = isRecord(result) && typeof result.error === 'string'
            ? result.error
            : 'Unable to load Affmine offers.'
          throw new Error(message)
        }
        const feedOffers = isRecord(result) && Array.isArray(result.offers)
          ? result.offers.filter(isAffmineOffer)
          : null
        if (!feedOffers) throw new Error('Affmine returned an invalid offer list.')
        setOffers(feedOffers)
      } catch (requestError) {
        if (controller.signal.aborted) return
        setError(requestError instanceof Error ? requestError.message : 'Unable to load Affmine offers.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadOffers()
    return () => controller.abort()
  }, [retryCount])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const existingIds = useMemo(() => new Set(existingOfferIds), [existingOfferIds])
  const countryOptions = useMemo(() => Array.from(new Set(offers.flatMap((offer) => offer.countries)))
    .sort((first, second) => countryName(first).localeCompare(countryName(second))), [offers])
  const categoryOptions = useMemo(() => Array.from(new Set(offers.map((offer) => offer.category).filter(Boolean)))
    .sort((first, second) => first.localeCompare(second)), [offers])
  const filteredOffers = useMemo(() => {
    const query = search.trim().toLowerCase()
    return offers.filter((offer) => {
      const types = offerTypes(offer)
      const matchesSearch = !query || [
        offer.id,
        offer.name,
        offer.category,
        offer.description,
        offer.countries.join(' '),
      ].join(' ').toLowerCase().includes(query)
      const matchesCountry = country === 'All'
        || (country === 'Global' ? offer.countries.length === 0 : offer.countries.includes(country))
      const matchesCategory = category === 'All' || offer.category === category
      const matchesType = type === 'All'
        || (type === 'Other' ? !types.some((offerType) => ['SOI', 'DOI'].includes(offerType)) : types.includes(type))
      const matchesDevice = device === 'All' || allOfferDevices.includes(device)
      return matchesSearch && matchesCountry && matchesCategory && matchesType && matchesDevice
    })
  }, [offers, search, country, category, type, device])
  const sortedOffers = useMemo(() => [...filteredOffers].sort((first, second) => {
    let order = 0
    if (sortKey === 'payout') {
      if (first.payout === null) return second.payout === null ? 0 : 1
      if (second.payout === null) return -1
      order = first.payout - second.payout
    } else if (sortKey === 'id' && /^\d+$/.test(first.id) && /^\d+$/.test(second.id)) {
      order = Number(first.id) - Number(second.id)
    } else {
      const firstValue = sortKey === 'name' ? first.name : first.id
      const secondValue = sortKey === 'name' ? second.name : second.id
      order = firstValue.localeCompare(secondValue, undefined, { numeric: true, sensitivity: 'base' })
    }
    return sortDirection === 'asc' ? order : -order
  }), [filteredOffers, sortKey, sortDirection])
  const pageCount = Math.max(1, Math.ceil(sortedOffers.length / pageSize))
  const visibleOffers = sortedOffers.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  const selectSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
    setPage(1)
  }

  const resetPage = () => setPage(1)
  const firstResult = sortedOffers.length ? (page - 1) * pageSize + 1 : 0
  const lastResult = Math.min(page * pageSize, sortedOffers.length)

  return (
    <div
      className={`${styles.backdrop} ${sidebarHidden ? styles.backdropExpanded : ''}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-label="Import offers from Affmine">
        <header className={styles.header}>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close offer picker">
            <X size={18} />
          </button>
        </header>

        <div className={styles.toolbar}>
          <label className={styles.search}>
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => { setSearch(event.target.value); resetPage() }}
              placeholder="Search offer name, ID, category, or country"
              aria-label="Search Affmine offers"
            />
          </label>
          <span className={styles.count} aria-live="polite">
            {loading ? 'Loading offers…' : `${filteredOffers.length} of ${offers.length} offers`}
          </span>
        </div>

        <div className={styles.filters} aria-label="Filter Affmine offers">
          <label>
            <span>Country</span>
            <select value={country} onChange={(event) => { setCountry(event.target.value); resetPage() }}>
              <option value="All">Worldwide</option>
              <option value="Global">Global</option>
              {countryOptions.map((code) => <option value={code} key={code}>{countryName(code)}</option>)}
            </select>
          </label>
          <label>
            <span>Device</span>
            <select value={device} onChange={(event) => { setDevice(event.target.value as DeviceFilter); resetPage() }}>
              <option value="All">All devices</option>
              {allOfferDevices.map((option) => <option value={option} key={option}>{option}</option>)}
            </select>
          </label>
          <label>
            <span>Category</span>
            <select value={category} onChange={(event) => { setCategory(event.target.value); resetPage() }}>
              <option value="All">All categories</option>
              {categoryOptions.map((option) => <option value={option} key={option}>{option}</option>)}
            </select>
          </label>
          <label>
            <span>Type</span>
            <select value={type} onChange={(event) => { setType(event.target.value); resetPage() }}>
              <option value="All">All types</option>
              <option value="SOI">SOI</option>
              <option value="DOI">DOI</option>
              <option value="Other">Other</option>
            </select>
          </label>
        </div>

        <div className={styles.tableArea} aria-live="polite">
          {loading ? (
            <p className={styles.status}>Loading offers from Affmine…</p>
          ) : error ? (
            <div className={styles.error} role="alert">
              <p>{error}</p>
              <button type="button" onClick={() => setRetryCount((count) => count + 1)}>Try again</button>
            </div>
          ) : (
            <div className={dashboardStyles.campaignTableWrap}>
              <table className={dashboardStyles.campaignTable}>
                <thead>
                  <tr>
                    <th aria-sort={sortKey === 'id' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" onClick={() => selectSort('id')}>ID</button>
                    </th>
                    <th>View</th>
                    <th aria-sort={sortKey === 'name' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" onClick={() => selectSort('name')}>Name</button>
                    </th>
                    <th aria-sort={sortKey === 'payout' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" onClick={() => selectSort('payout')}>Payout</button>
                    </th>
                    <th>Category</th>
                    <th>Geo</th>
                    <th>Device</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleOffers.length ? visibleOffers.map((offer) => {
                    const alreadyAdded = existingIds.has(offer.id)
                    const hasUsdPayout = offer.currency === 'USD' && offer.payout !== null && offer.payout > 0
                    const canImport = !alreadyAdded
                      && /^\d+$/.test(offer.id)
                      && hasUsdPayout
                      && Boolean(offer.trackingUrl)
                    return (
                      <tr key={offer.id}>
                        <td>{offer.id}</td>
                        <td>
                          {offer.previewUrl ? (
                            <Image
                              className={dashboardStyles.campaignThumb}
                              src={offer.previewUrl}
                              alt=""
                              width={64}
                              height={50}
                              unoptimized
                            />
                          ) : (
                            <div className={styles.imagePlaceholder} aria-label="No offer image">—</div>
                          )}
                        </td>
                        <td>
                          <span className={dashboardStyles.campaignName} title={offer.description}>{offer.name}</span>
                        </td>
                        <td>
                          <strong className={dashboardStyles.campaignPayout}>
                            {offer.payout === null ? '—' : `$${offer.payout.toFixed(2)}`}
                          </strong>
                          <span className={dashboardStyles.campaignTags}>
                            {offerTypes(offer).map((offerType) => <span key={offerType}>{offerType}</span>)}
                          </span>
                        </td>
                        <td>{offer.category || 'General'}</td>
                        <td>
                          {offer.countries.length ? (
                            <span className={dashboardStyles.campaignGeoFlags}>
                              {offer.countries.map((geo) => {
                                const Flag = CountryFlags[geo.toUpperCase() as keyof typeof CountryFlags]
                                return Flag
                                  ? <Flag key={geo} className={dashboardStyles.campaignFlag} aria-label={countryName(geo)} title={countryName(geo)} />
                                  : <span key={geo}>{geo}</span>
                              })}
                            </span>
                          ) : <span className={styles.globalGeo}>Global</span>}
                        </td>
                        <td>
                          <span className={dashboardStyles.deviceIcons} aria-label="All devices" title="All devices">
                            <i className={`fas fa-lg fa-desktop ${dashboardStyles.deviceIcon}`} title="Desktop" aria-hidden="true" />
                            <i className={`fas fa-lg fa-robot ${dashboardStyles.deviceIcon}`} title="Android" aria-hidden="true" />
                            <i className={`fab fa-lg fa-apple ${dashboardStyles.deviceIcon}`} title="iOS" aria-hidden="true" />
                            <i className={`fas fa-lg fa-mobile-alt ${dashboardStyles.deviceIcon} ${dashboardStyles.deviceIconMobile}`} title="Other mobile" aria-hidden="true" />
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`${dashboardStyles.offerAction} ${dashboardStyles.offerActionApply} ${styles.importButton}`}
                            disabled={!canImport}
                            title={!hasUsdPayout ? 'Only offers with a valid USD payout can be imported.' : !offer.trackingUrl ? 'Tracking link is missing.' : undefined}
                            onClick={() => onImport(offer)}
                          >
                            {alreadyAdded ? 'Added' : canImport ? 'Import' : 'Unavailable'}
                          </button>
                          {!alreadyAdded && !canImport && (
                            <span className={styles.unavailable}>
                              {!hasUsdPayout ? 'USD payout required' : !offer.trackingUrl ? 'Tracking link missing' : 'Numeric ID required'}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  }) : (
                    <tr>
                      <td className={dashboardStyles.campaignNoResults} colSpan={8}>
                        {search || country !== 'All' || device !== 'All' || category !== 'All' || type !== 'All'
                          ? 'No offers match your filters.'
                          : 'No offers are available.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <footer className={styles.footer}>
          <span>
            {offers.length ? sortedOffers.length
              ? `Showing ${firstResult}–${lastResult} of ${sortedOffers.length} offers. `
              : 'No matching offers. ' : ''}
            Offers are added to your catalog after you submit the campaign form.
          </span>
          <div className={styles.pagination}>
            <label>
              <span>Rows</span>
              <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); resetPage() }}>
                {pageSizes.map((size) => <option value={size} key={size}>{size}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} aria-label="Previous page">
              <ChevronLeft size={15} />
            </button>
            <span>Page {page} of {pageCount}</span>
            <button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page >= pageCount} aria-label="Next page">
              <ChevronRight size={15} />
            </button>
            <button type="button" className={styles.cancelButton} onClick={onClose}>Close</button>
          </div>
        </footer>
      </section>
    </div>
  )
}
