import { prisma } from '@/lib/db/prisma'

export class ConversionReversalError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message)
  }
}

export function isCreditedConversionStatus(status: string | null | undefined): boolean {
  const value = (status || '').trim().toLowerCase()
  return !value || value === 'approved' || value === 'credited' || value === '1' || value === 'ok'
}

export function calculatePendingInvoiceTotals(
  conversions: Array<{ status: string | null; payout: number | null }>,
) {
  const payableConversions = conversions.filter(
    (conversion) => conversion.status?.trim().toLowerCase() !== 'reversed' && conversion.payout !== null,
  )
  const total = payableConversions.reduce((sum, conversion) => sum + Number(conversion.payout), 0)
  const totalEarning = Math.round((total + Number.EPSILON) * 100) / 100

  return {
    totalEarning,
    conversionCount: payableConversions.length,
    removeInvoice: payableConversions.length === 0 || totalEarning <= 0,
  }
}

export async function reversePublisherConversion(conversionId: string) {
  const reversal = await prisma.$transaction(async (transaction) => {
    const conversion = await transaction.conversionLead.findUnique({
      where: { id: conversionId },
      select: {
        id: true,
        userId: true,
        offerId: true,
        campaignId: true,
        campaignName: true,
        status: true,
        payout: true,
        country: true,
        ipAddress: true,
        sub3: true,
        sub4: true,
        publisherSub3: true,
        occurredAt: true,
        createdAt: true,
        publisherInvoiceId: true,
      },
    })
    if (!conversion) throw new ConversionReversalError(404, 'Conversion not found.')
    if (!isCreditedConversionStatus(conversion.status)) {
      if (conversion.status?.trim().toLowerCase() === 'reversed') {
        throw new ConversionReversalError(409, 'This conversion has already been reversed.')
      }
      throw new ConversionReversalError(409, 'Only credited conversions can be reversed.')
    }

    let invoiceId: string | null = null
    if (conversion.publisherInvoiceId) {
      const invoices = await transaction.$queryRaw<Array<{ id: string; status: string }>>`
        SELECT "id", "status"
        FROM "publisher_payment_invoices"
        WHERE "id" = ${conversion.publisherInvoiceId}
        FOR UPDATE
      `
      const invoice = invoices[0]
      if (!invoice) {
        throw new ConversionReversalError(409, 'The conversion invoice could not be found; refresh and try again.')
      }
      if (invoice.status === 'PAID') {
        throw new ConversionReversalError(409, 'This conversion is on a paid invoice and cannot be reversed.')
      }
      invoiceId = invoice.id
    }

    const changed = await transaction.conversionLead.updateMany({
      where: {
        id: conversion.id,
        status: conversion.status,
        publisherInvoiceId: conversion.publisherInvoiceId,
      },
      data: { status: 'Reversed' },
    })
    if (changed.count !== 1) {
      throw new ConversionReversalError(409, 'Conversion changed while reversal was processing; refresh and try again.')
    }

    let invoiceRemoved = false
    let invoiceTotal: number | null = null
    if (invoiceId) {
      const invoiceConversions = await transaction.conversionLead.findMany({
        where: { publisherInvoiceId: invoiceId, payout: { not: null } },
        select: { status: true, payout: true },
      })
      const invoiceTotals = calculatePendingInvoiceTotals(invoiceConversions)
      if (invoiceTotals.removeInvoice) {
        await transaction.publisherPaymentInvoice.delete({ where: { id: invoiceId } })
        invoiceRemoved = true
      } else {
        await transaction.publisherPaymentInvoice.update({
          where: { id: invoiceId },
          data: {
            totalEarning: invoiceTotals.totalEarning,
            conversionCount: invoiceTotals.conversionCount,
          },
        })
        invoiceTotal = invoiceTotals.totalEarning
      }
    }

    return {
      status: 'Reversed' as const,
      payoutRemoved: Number(conversion.payout ?? 0),
      invoiceId,
      invoiceRemoved,
      invoiceTotal,
      publisherId: conversion.userId,
      postbackLead: {
        offerId: conversion.offerId,
        campaignId: conversion.campaignId,
        campaignName: conversion.campaignName,
        payout: conversion.payout,
        country: conversion.country,
        ipAddress: conversion.ipAddress,
        status: 'Reversed',
        sub3: conversion.sub3,
        sub4: conversion.sub4,
        publisherSub3: conversion.publisherSub3,
        occurredAt: conversion.occurredAt,
        createdAt: conversion.createdAt,
      },
    }
  })

  const { publisherId, postbackLead, ...result } = reversal
  try {
    const { firePublisherGlobalPostback } = await import('@/lib/publisher-postback')
    await firePublisherGlobalPostback(publisherId, postbackLead)
  } catch (error) {
    console.error('Publisher reversal postback dispatch failed:', error)
  }
  return result
}
