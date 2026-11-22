import { randomBytes } from 'crypto'
import { NextResponse } from 'next/server'
import { getCorsHeaders } from '@/config/cors'
import { getTokenFromCookie, getUserFromToken, normalizeEffectiveUserRole } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'

const PAYOUT_METHOD = 'BINANCE_PAY_USDT'

class PaymentConflictError extends Error {}

function createInvoiceNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `USD-${date}-${randomBytes(4).toString('hex').toUpperCase()}`
}

async function authenticate(request: Request) {
  const origin = request.headers.get('origin') || null
  const token = getTokenFromCookie(request.headers.get('cookie') || '')
  if (!token) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders(origin) }),
    }
  }

  const user = await getUserFromToken(token)
  if (!user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: getCorsHeaders(origin) }),
    }
  }
  return { user, role: normalizeEffectiveUserRole(user) || user.role, origin }
}

export async function GET(request: Request) {
  const auth = await authenticate(request)
  if ('error' in auth) return auth.error

  try {
    if (auth.role === 'MANAGER') {
      const [publishers, unbilledEarnings, invoiceTotals, invoices] = await Promise.all([
        prisma.user.findMany({
          where: { role: 'PUBLISHER' },
          select: {
            id: true,
            username: true,
            fullName: true,
            email: true,
            publisherNumber: true,
            status: true,
            payoutMethod: true,
            payoutAccount: true,
          },
          orderBy: [{ status: 'asc' }, { username: 'asc' }],
        }),
        prisma.conversionLead.groupBy({
          by: ['userId'],
          where: { publisherInvoiceId: null, payout: { not: null } },
          _sum: { payout: true },
          _count: { _all: true },
        }),
        prisma.publisherPaymentInvoice.groupBy({
          by: ['publisherId', 'status'],
          _sum: { totalEarning: true },
          _count: { _all: true },
        }),
        prisma.publisherPaymentInvoice.findMany({
          include: {
            publisher: {
              select: {
                id: true,
                username: true,
                fullName: true,
                email: true,
                publisherNumber: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 500,
        }),
      ])

      const earningsByPublisher = new Map(
        unbilledEarnings.map((row) => [row.userId, {
          amount: Number(row._sum.payout ?? 0),
          conversions: row._count._all,
        }]),
      )
      const totalsByPublisher = new Map<string, { pending: number; paid: number; pendingCount: number }>()
      for (const row of invoiceTotals) {
        const totals = totalsByPublisher.get(row.publisherId) || { pending: 0, paid: 0, pendingCount: 0 }
        if (row.status === 'PENDING') {
          totals.pending = Number(row._sum.totalEarning ?? 0)
          totals.pendingCount = row._count._all
        } else {
          totals.paid = Number(row._sum.totalEarning ?? 0)
        }
        totalsByPublisher.set(row.publisherId, totals)
      }
      const pending = [...totalsByPublisher.values()].reduce(
        (total, publisherTotals) => ({
          amount: total.amount + publisherTotals.pending,
          count: total.count + publisherTotals.pendingCount,
        }),
        { amount: 0, count: 0 },
      )
      const paid = [...totalsByPublisher.values()].reduce((sum, publisherTotals) => sum + publisherTotals.paid, 0)

      return NextResponse.json({
        role: 'MANAGER',
        summary: {
          publishers: publishers.length,
          available: [...earningsByPublisher.values()].reduce((sum, item) => sum + item.amount, 0),
          pending: pending.amount,
          paid,
          pendingInvoices: pending.count,
        },
        publishers: publishers.map((publisher) => ({
          ...publisher,
          availableEarnings: earningsByPublisher.get(publisher.id)?.amount ?? 0,
          availableConversions: earningsByPublisher.get(publisher.id)?.conversions ?? 0,
          pendingEarnings: totalsByPublisher.get(publisher.id)?.pending ?? 0,
          paidEarnings: totalsByPublisher.get(publisher.id)?.paid ?? 0,
        })),
        invoices,
      }, { headers: getCorsHeaders(auth.origin) })
    }

    const [publisher, earnings, totals, invoices] = await Promise.all([
      prisma.user.findUnique({
        where: { id: auth.user.id },
        select: { payoutMethod: true, payoutAccount: true },
      }),
      prisma.conversionLead.aggregate({
        where: { userId: auth.user.id, publisherInvoiceId: null, payout: { not: null } },
        _sum: { payout: true },
        _count: { _all: true },
      }),
      prisma.publisherPaymentInvoice.groupBy({
        by: ['status'],
        where: { publisherId: auth.user.id },
        _sum: { totalEarning: true },
        _count: { _all: true },
      }),
      prisma.publisherPaymentInvoice.findMany({
        where: { publisherId: auth.user.id },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    ])
    const totalsByStatus = new Map(
      totals.map((row) => [row.status, {
        amount: Number(row._sum.totalEarning ?? 0),
        count: row._count._all,
      }]),
    )
    const pending = totalsByStatus.get('PENDING') || { amount: 0, count: 0 }
    const paid = totalsByStatus.get('PAID') || { amount: 0, count: 0 }

    return NextResponse.json({
      role: 'PUBLISHER',
      summary: {
        available: Number(earnings._sum.payout ?? 0),
        pending: pending.amount,
        paid: paid.amount,
        payments: paid.count,
        conversions: earnings._count._all,
      },
      payout: {
        method: publisher?.payoutMethod ?? '',
        account: publisher?.payoutAccount ?? '',
      },
      invoices,
    }, { headers: getCorsHeaders(auth.origin) })
  } catch (error) {
    console.error('Load payment data failed:', error)
    return NextResponse.json(
      { error: 'Unable to load payment data' },
      { status: 503, headers: getCorsHeaders(auth.origin) },
    )
  }
}

export async function PATCH(request: Request) {
  const auth = await authenticate(request)
  if ('error' in auth) return auth.error
  if (auth.role !== 'PUBLISHER') {
    return NextResponse.json({ error: 'Only publishers can update payout details' }, {
      status: 403,
      headers: getCorsHeaders(auth.origin),
    })
  }

  let body: { payoutAccount?: unknown }
  try {
    body = await request.json() as { payoutAccount?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, {
      status: 400,
      headers: getCorsHeaders(auth.origin),
    })
  }

  const payoutAccount = typeof body.payoutAccount === 'string' ? body.payoutAccount.trim() : ''
  if (!payoutAccount || payoutAccount.length > 200) {
    return NextResponse.json({ error: 'Enter a Binance Pay ID or account email (up to 200 characters).' }, {
      status: 400,
      headers: getCorsHeaders(auth.origin),
    })
  }

  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: auth.user.id },
        data: { payoutMethod: PAYOUT_METHOD, payoutAccount },
      }),
      prisma.publisherPaymentInvoice.updateMany({
        where: { publisherId: auth.user.id, status: 'PENDING' },
        data: { payoutMethod: PAYOUT_METHOD, payoutAccount },
      }),
    ])
    return NextResponse.json({ payout: { method: PAYOUT_METHOD, account: payoutAccount } }, {
      headers: getCorsHeaders(auth.origin),
    })
  } catch (error) {
    console.error('Save publisher payout details failed:', error)
    return NextResponse.json({ error: 'Unable to save payout details' }, {
      status: 503,
      headers: getCorsHeaders(auth.origin),
    })
  }
}

export async function POST(request: Request) {
  const auth = await authenticate(request)
  if ('error' in auth) return auth.error
  if (auth.role !== 'MANAGER') {
    return NextResponse.json({ error: 'Only managers can process publisher payments' }, {
      status: 403,
      headers: getCorsHeaders(auth.origin),
    })
  }

  let body: { action?: unknown; publisherId?: unknown; invoiceId?: unknown }
  try {
    body = await request.json() as { action?: unknown; publisherId?: unknown; invoiceId?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, {
      status: 400,
      headers: getCorsHeaders(auth.origin),
    })
  }

  try {
    if (body.action === 'move-to-pending' && typeof body.publisherId === 'string') {
      const publisherId = body.publisherId
      const invoice = await prisma.$transaction(async (transaction) => {
        const publisher = await transaction.user.findFirst({
          where: { id: publisherId, role: 'PUBLISHER' },
          select: { payoutMethod: true, payoutAccount: true },
        })
        if (!publisher) throw new PaymentConflictError('Publisher not found')
        if (publisher.payoutMethod !== PAYOUT_METHOD || !publisher.payoutAccount?.trim()) {
          throw new PaymentConflictError('This publisher must set a Binance Pay ID or account email before earnings can be moved to pending.')
        }

        const conversions = await transaction.conversionLead.findMany({
          where: { userId: publisherId, publisherInvoiceId: null, payout: { not: null } },
          select: { id: true, payout: true },
        })
        const total = conversions.reduce((sum, conversion) => sum + Number(conversion.payout ?? 0), 0)
        const totalEarning = Math.round((total + Number.EPSILON) * 100) / 100
        if (!conversions.length || totalEarning <= 0) {
          throw new PaymentConflictError('There are no un-invoiced earnings available to move to pending.')
        }

        const createdInvoice = await transaction.publisherPaymentInvoice.create({
          data: {
            invoiceNumber: createInvoiceNumber(),
            publisherId,
            totalEarning,
            conversionCount: conversions.length,
            payoutMethod: PAYOUT_METHOD,
            payoutAccount: publisher.payoutAccount,
          },
        })
        const attached = await transaction.conversionLead.updateMany({
          where: {
            id: { in: conversions.map((conversion) => conversion.id) },
            publisherInvoiceId: null,
          },
          data: { publisherInvoiceId: createdInvoice.id },
        })
        if (attached.count !== conversions.length) {
          throw new PaymentConflictError('Earnings changed while the invoice was being created. Refresh and try again.')
        }
        return createdInvoice
      })

      return NextResponse.json({ invoice }, { headers: getCorsHeaders(auth.origin) })
    }

    if (body.action === 'mark-paid' && typeof body.invoiceId === 'string') {
      const result = await prisma.publisherPaymentInvoice.updateMany({
        where: { id: body.invoiceId, status: 'PENDING' },
        data: { status: 'PAID', paidAt: new Date(), paidById: auth.user.id },
      })
      if (result.count !== 1) {
        return NextResponse.json({ error: 'Pending invoice not found; refresh and try again.' }, {
          status: 409,
          headers: getCorsHeaders(auth.origin),
        })
      }
      return NextResponse.json({ success: true }, { headers: getCorsHeaders(auth.origin) })
    }

    return NextResponse.json({ error: 'Invalid payment action' }, {
      status: 400,
      headers: getCorsHeaders(auth.origin),
    })
  } catch (error) {
    if (error instanceof PaymentConflictError) {
      const status = error.message === 'Publisher not found' ? 404 : 409
      return NextResponse.json({ error: error.message }, { status, headers: getCorsHeaders(auth.origin) })
    }
    console.error('Process publisher payment failed:', error)
    return NextResponse.json({ error: 'Unable to process publisher payment' }, {
      status: 503,
      headers: getCorsHeaders(auth.origin),
    })
  }
}
