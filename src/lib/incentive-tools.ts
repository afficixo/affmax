export type IncentiveToolKind = 'locker' | 'offerwall'

export type IncentiveToolToggles = {
  showLock: boolean
  roundCurrency: boolean
  hideCurrency: boolean
}

export type IncentiveToolRecord = {
  id: string
  kind: IncentiveToolKind
  name: string
  createdAt: string
  updatedAt: string
  fields: Record<string, string>
  toggles: IncentiveToolToggles
  /** Empty = use every active incentive offer. */
  selectedOfferIds: string[]
}

export type IncentiveWidgetOffer = {
  id: string
  name: string
  payout: number
  category: string
  country: string
  countries?: string[]
  offerTypes: string[]
  imageSource: string
  description?: string
  offerLink: string
  device?: string[]
}

export const contentLockersStorageKey = 'crackbounty-content-lockers'
export const offerwallsStorageKey = 'crackbounty-offerwalls'
export const activeIncentiveOffersStorageKey = 'crackbounty-active-incentive-offers'
export const customOffersStorageKey = 'crackbounty-custom-offers'
export const campaignOverridesStorageKey = 'crackbounty-campaign-overrides'
export const deletedCampaignsStorageKey = 'crackbounty-deleted-campaigns'
export const dashboardNoticeStorageKey = 'crackbounty.dashboardNotice'

const legacyStorageKeys = [
  [contentLockersStorageKey, 'affmine-content-lockers'],
  [offerwallsStorageKey, 'affmine-offerwalls'],
  [activeIncentiveOffersStorageKey, 'affmine-active-incentive-offers'],
  [customOffersStorageKey, 'affmine-custom-offers'],
  [campaignOverridesStorageKey, 'affmine-campaign-overrides'],
  [deletedCampaignsStorageKey, 'affmine-deleted-campaigns'],
] as const

let legacyStorageMigrated = false

export function migrateLegacyIncentiveToolStorage() {
  if (typeof window === 'undefined' || legacyStorageMigrated) return
  legacyStorageMigrated = true

  for (const [key, legacyKey] of legacyStorageKeys) {
    try {
      const legacyValue = window.localStorage.getItem(legacyKey)
      if (legacyValue === null) continue

      if (window.localStorage.getItem(key) === null) {
        window.localStorage.setItem(key, legacyValue)
      }
      window.localStorage.removeItem(legacyKey)
    } catch (error) {
      console.error(`Unable to migrate saved data from ${legacyKey}`, error)
    }
  }

  try {
    const legacyNotice = window.sessionStorage.getItem('affmine.dashboardNotice')
    if (legacyNotice !== null) {
      if (window.sessionStorage.getItem(dashboardNoticeStorageKey) === null) {
        window.sessionStorage.setItem(dashboardNoticeStorageKey, legacyNotice)
      }
      window.sessionStorage.removeItem('affmine.dashboardNotice')
    }
  } catch (error) {
    console.error('Unable to migrate the saved dashboard notice', error)
  }
}

export const defaultLockerFields: Record<string, string> = {
  lockerName: '',
  conversionsRequired: '1',
  minimumPayout: '0.25',
  desktopMaxOffers: '5',
  mobileMaxOffers: 'No limit',
  unlockAction: 'Redirect to URL',
  redirectUrl: 'https://example.com/unlocked',
  javascriptAction: 'Show on page load',
  lockerTitle: 'Complete an offer below to unlock your content.',
  lockerDescription: 'Unlocking will allow access to the premium content.',
  lockerButtonText: 'Unlock content',
  lockerMainColor: '#43b6d6',
  lockerBackground: '#ffffff',
  offersBackground: '#f7f8f9',
  offersTextColor: '#58666e',
  offersButtonColor: '#5cb85c',
}

export const defaultOfferwallFields: Record<string, string> = {
  offerwallName: '',
  exchangeRate: '100',
  currencyName: 'Points',
  minimumPayout: '',
  offerwallTitle: 'Complete offers and earn rewards',
  offerwallBackground: '#ffffff',
  offerBoxBackground: '#f7f8f9',
  offerBoxText: '#58666e',
  offerButtonColor: '#43b6d6',
  offerButtonBorder: '#43b6d6',
}

export const defaultLockerToggles: IncentiveToolToggles = {
  showLock: true,
  roundCurrency: true,
  hideCurrency: false,
}

export const defaultOfferwallToggles: IncentiveToolToggles = {
  showLock: true,
  roundCurrency: true,
  hideCurrency: false,
}

export function incentiveOfferDestination(offer: Pick<IncentiveWidgetOffer, 'id' | 'offerLink'>) {
  const link = (offer.offerLink || '').trim()
  if (link) return link
  return `https://crackbounty.afficix.com/click/${offer.id}?src=incentive`
}

export function toolPublicPath(tool: Pick<IncentiveToolRecord, 'id' | 'kind'>) {
  return tool.kind === 'locker' ? `/locker/${tool.id}` : `/wall/${tool.id}`
}

export function toolEmbedCode(tool: IncentiveToolRecord, origin = '') {
  const path = toolPublicPath(tool)
  const src = origin ? `${origin}${path}` : path
  const height = tool.kind === 'locker' ? 560 : 720
  const title = tool.kind === 'locker' ? 'Content Locker' : 'OfferWall'
  return `<iframe src="${src}" title="${title}" width="100%" height="${height}" frameborder="0" allow="clipboard-write" style="border:0;border-radius:8px;overflow:hidden;background:#fff;"></iframe>`
}

export function readJsonArray<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  migrateLegacyIncentiveToolStorage()
  try {
    const raw = window.localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) as unknown : []
    return Array.isArray(parsed) ? parsed as T[] : []
  } catch {
    return []
  }
}

export function writeJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore quota */
  }
}

export function createToolId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

export function toolDisplayName(tool: IncentiveToolRecord) {
  if (tool.kind === 'locker') return tool.fields.lockerName?.trim() || tool.name || `Locker ${tool.id}`
  return tool.fields.offerwallName?.trim() || tool.name || `OfferWall ${tool.id}`
}

export function parseToolList(raw: unknown, kind: IncentiveToolKind): IncentiveToolRecord[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((item): item is IncentiveToolRecord => (
    typeof item?.id === 'string'
    && item?.kind === kind
    && typeof item?.name === 'string'
    && typeof item?.fields === 'object'
    && item.fields !== null
  )).map((item) => ({
    ...item,
    selectedOfferIds: Array.isArray(item.selectedOfferIds) ? item.selectedOfferIds.filter((id): id is string => typeof id === 'string') : [],
    toggles: {
      showLock: item.toggles?.showLock ?? true,
      roundCurrency: item.toggles?.roundCurrency ?? true,
      hideCurrency: item.toggles?.hideCurrency ?? false,
    },
  }))
}
