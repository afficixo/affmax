import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  calculatePendingInvoiceTotals,
  isCreditedConversionStatus,
} from '../src/lib/conversion-reversal'

test('only credited conversions can be reversed', () => {
  assert.equal(isCreditedConversionStatus('Approved'), true)
  assert.equal(isCreditedConversionStatus(null), true)
  assert.equal(isCreditedConversionStatus('Reversed'), false)
  assert.equal(isCreditedConversionStatus('Rejected'), false)
})

test('recalculates pending invoice totals without reversed conversions', () => {
  assert.deepEqual(
    calculatePendingInvoiceTotals([
      { status: 'Approved', payout: 2 },
      { status: 'Reversed', payout: 3 },
      { status: null, payout: 1.125 },
    ]),
    { totalEarning: 3.13, conversionCount: 2, removeInvoice: false },
  )
})

test('removes a pending invoice when no payable conversions remain', () => {
  assert.deepEqual(
    calculatePendingInvoiceTotals([{ status: 'Reversed', payout: 2 }]),
    { totalEarning: 0, conversionCount: 0, removeInvoice: true },
  )
})
