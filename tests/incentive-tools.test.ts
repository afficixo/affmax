import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  customOffersStorageKey,
  migrateLegacyIncentiveToolStorage,
  offerwallsStorageKey,
  dashboardNoticeStorageKey,
} from '../src/lib/incentive-tools'

function createStorage(initial: Record<string, string>) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  }
}

test('migrates saved settings and notices to the Crack Bounty storage keys', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const localStorage = createStorage({
    'affmine-custom-offers': '[{"id":"legacy-offer"}]',
    'affmine-offerwalls': '[{"id":"legacy-wall"}]',
    [offerwallsStorageKey]: '[{"id":"current-wall"}]',
  })
  const sessionStorage = createStorage({
    'affmine.dashboardNotice': '{"id":"legacy-notice"}',
  })

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage, sessionStorage },
  })

  try {
    migrateLegacyIncentiveToolStorage()

    assert.equal(localStorage.getItem(customOffersStorageKey), '[{"id":"legacy-offer"}]')
    assert.equal(localStorage.getItem('affmine-custom-offers'), null)
    assert.equal(localStorage.getItem(offerwallsStorageKey), '[{"id":"current-wall"}]')
    assert.equal(localStorage.getItem('affmine-offerwalls'), null)
    assert.equal(sessionStorage.getItem(dashboardNoticeStorageKey), '{"id":"legacy-notice"}')
    assert.equal(sessionStorage.getItem('affmine.dashboardNotice'), null)
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
    else Reflect.deleteProperty(globalThis, 'window')
  }
})
