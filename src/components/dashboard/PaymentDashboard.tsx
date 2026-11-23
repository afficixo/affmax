'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import styles from './Dashboard.module.css'

type PaymentInvoice = {
  id: string
  invoiceNumber: string
  totalEarning: number
  conversionCount: number
  payoutMethod: string | null
  payoutAccount: string | null
  status: 'PENDING' | 'PAID'
  createdAt: string
  paidAt: string | null
  publisher?: {
    id: string
    username: string
    fullName: string | null
    email: string
    publisherNumber: number | null
  }
}

type ManagerPayments = {
  role: 'MANAGER'
  summary: {
    publishers: number
    available: number
    pending: number
    paid: number
    pendingInvoices: number
  }
  publishers: Array<{
    id: string
    username: string
    fullName: string | null
    email: string
    publisherNumber: number | null
    status: string
    payoutMethod: string | null
    payoutAccount: string | null
    availableEarnings: number
    availableConversions: number
    pendingEarnings: number
    paidEarnings: number
  }>
  invoices: PaymentInvoice[]
}

type PublisherPayments = {
  role: 'PUBLISHER'
  summary: {
    available: number
    pending: number
    paid: number
    payments: number
    conversions: number
  }
  payout: { method: string; account: string }
  invoices: PaymentInvoice[]
}

type PaymentsData = ManagerPayments | PublisherPayments

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(date)
}

function publisherName(publisher: { fullName: string | null; username: string }) {
  return publisher.fullName?.trim() || publisher.username
}

function isPaymentPayable(method: string | null, account: string | null) {
  return method === 'BINANCE_PAY_USDT' && Boolean(account?.trim())
}

export default function PaymentDashboard() {
  const [data, setData] = useState<PaymentsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [accountDraft, setAccountDraft] = useState('')
  const [publisherSearch, setPublisherSearch] = useState('')
  const [busyAction, setBusyAction] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const loadPayments = useCallback(async (showLoading = true, syncPayoutDraft = true) => {
    if (showLoading) setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/payments', { credentials: 'include', cache: 'no-store' })
      const result = await response.json() as PaymentsData & { error?: string }
      if (!response.ok) throw new Error(result.error || 'Unable to load payment data')
      setData(result)
      if (result.role === 'PUBLISHER' && syncPayoutDraft) setAccountDraft(result.payout.account)
    } catch (loadError) {
      console.error('Unable to load payment page:', loadError)
      setError(loadError instanceof Error ? loadError.message : 'Unable to load payment data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPayments()
  }, [loadPayments])

  useEffect(() => {
    const refreshVisiblePayments = () => {
      if (document.visibilityState === 'visible') void loadPayments(false, false)
    }
    const intervalId = window.setInterval(refreshVisiblePayments, 15000)
    document.addEventListener('visibilitychange', refreshVisiblePayments)
    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', refreshVisiblePayments)
    }
  }, [loadPayments])

  const savePayoutDetails = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusyAction('save')
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/payments', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ payoutAccount: accountDraft }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error || 'Unable to save payout details')
      setNotice('Binance Pay details saved.')
      await loadPayments(false)
    } catch (saveError) {
      console.error('Unable to save payout details:', saveError)
      setError(saveError instanceof Error ? saveError.message : 'Unable to save payout details')
    } finally {
      setBusyAction('')
    }
  }

  const runManagerAction = async (action: 'move-to-pending' | 'mark-paid', id: string) => {
    if (action === 'mark-paid' && !window.confirm('Confirm that you have sent this payment and want to mark the USD invoice paid.')) {
      return
    }
    setBusyAction(id)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(action === 'move-to-pending'
          ? { action, publisherId: id }
          : { action, invoiceId: id }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error || 'Unable to process payment')
      setNotice(action === 'move-to-pending' ? 'Available publisher earnings moved to pending.' : 'Invoice marked as paid.')
      await loadPayments(false)
    } catch (actionError) {
      console.error('Unable to process publisher payment:', actionError)
      setError(actionError instanceof Error ? actionError.message : 'Unable to process payment')
    } finally {
      setBusyAction('')
    }
  }

  if (loading && !data) {
    return (
      <div className={styles.paymentLoading} role="status" aria-label="Loading payment details" aria-live="polite" aria-busy="true">
        <span className={styles.paymentLoadingSpinner} aria-hidden="true" />
      </div>
    )
  }
  if (error && !data) {
    return <section className={`${styles.panel} ${styles.dataPage}`}><p className={styles.paymentError} role="alert">{error}</p></section>
  }
  if (!data) return null

  if (data.role === 'MANAGER') {
    const pendingInvoices = data.invoices.filter((invoice) => invoice.status === 'PENDING')
    const query = publisherSearch.trim().toLowerCase()
    const filteredPublishers = data.publishers.filter((publisher) => {
      if (!query) return true
      return [
        publisher.fullName,
        publisher.username,
        publisher.email,
        publisher.publisherNumber == null ? '' : String(publisher.publisherNumber),
        publisher.payoutAccount,
      ].some((value) => value?.toLowerCase().includes(query))
    })
    const renderMoveToPendingButton = (publisher: (typeof filteredPublishers)[number]) => {
      const payable = isPaymentPayable(publisher.payoutMethod, publisher.payoutAccount)
      const hasAvailableEarnings = publisher.availableEarnings > 0
      return (
        <button
          type="button"
          className={styles.pagePrimaryButton}
          disabled={!hasAvailableEarnings || !payable || busyAction === publisher.id}
          onClick={() => void runManagerAction('move-to-pending', publisher.id)}
          title={!payable
            ? 'Publisher must save their Binance Pay ID or account email before earnings can be moved to pending'
            : !hasAvailableEarnings
              ? 'No available earnings to move to pending'
              : undefined}
        >
          {busyAction === publisher.id ? 'Moving…' : 'Move to pending'}
        </button>
      )
    }
    return (
      <>
        <section className={`${styles.panel} ${styles.dataPage} ${styles.paymentInfo}`}>
          <h2 className={styles.sectionTitle}><i className="fa fa-info" aria-hidden="true" />PUBLISHER PAYMENTS</h2>
          <div className={styles.paymentSummary}>
            <div><strong>{data.summary.publishers}</strong><span>Publishers</span></div>
            <div><strong>{usd.format(data.summary.pending)}</strong><span>Pending</span></div>
            <div><strong>{usd.format(data.summary.available)}</strong><span>Available earnings</span></div>
            <div><strong>{usd.format(data.summary.paid)}</strong><span>Total paid</span></div>
          </div>
          <section className={styles.paymentInfoSection}>
            <p>Every un-invoiced conversion with a payout is available immediately, including postbacks received today. Move available earnings to pending to create an invoice. All amounts are calculated in USD; transfers are not sent automatically.</p>
            {notice ? <p className={styles.pageNotice} role="status">{notice}</p> : null}
            {error ? <p className={styles.paymentError} role="alert">{error}</p> : null}
          </section>
        </section>

        <section className={`${styles.panel} ${styles.dataPage} ${styles.paymentSettings}`}>
          <div className={`${styles.dataPageHeading} ${styles.paymentManagerHeading}`}>
            <h2><i className="fa fa-credit-card" aria-hidden="true" />PUBLISHER FUNDING DETAILS</h2>
            <input
              type="search"
              aria-label="Search publishers by name, email, publisher ID, or Binance Pay details"
              placeholder="Search publishers"
              value={publisherSearch}
              onChange={(event) => setPublisherSearch(event.target.value)}
            />
          </div>
          <p className={styles.pageHint}>Showing {filteredPublishers.length} of {data.publishers.length} publishers.</p>
          <div className={styles.paymentPublisherCards}>
            {filteredPublishers.map((publisher) => {
              const payable = isPaymentPayable(publisher.payoutMethod, publisher.payoutAccount)
              return (
                <article className={styles.paymentPublisherCard} key={publisher.id}>
                  <header className={styles.paymentPublisherCardHeader}>
                    <strong className={styles.paymentPublisherCardName}>{publisherName(publisher)}</strong>
                    <span className={styles.paymentAccountMeta}>
                      {publisher.publisherNumber == null ? publisher.email : `#${publisher.publisherNumber} · ${publisher.email}`}
                    </span>
                  </header>
                  <dl className={styles.paymentPublisherCardDetails}>
                    <div>
                      <dt>Status</dt>
                      <dd>{publisher.status}</dd>
                    </div>
                    <div>
                      <dt>Payment status</dt>
                      <dd>
                        <span className={`${styles.paymentReadiness} ${payable ? styles.paymentReadinessPayable : styles.paymentReadinessRequired}`}>
                          {payable ? 'Payable' : 'Payment method required'}
                        </span>
                      </dd>
                    </div>
                    <div className={styles.paymentPublisherCardWide}>
                      <dt>Binance Pay ID / email</dt>
                      <dd>{publisher.payoutAccount || 'Not set'}</dd>
                    </div>
                    <div>
                      <dt>Available earnings</dt>
                      <dd className={styles.paymentUp}>{usd.format(publisher.availableEarnings)}</dd>
                    </div>
                    <div>
                      <dt>Pending</dt>
                      <dd>{usd.format(publisher.pendingEarnings)}</dd>
                    </div>
                    <div>
                      <dt>Total paid</dt>
                      <dd>{usd.format(publisher.paidEarnings)}</dd>
                    </div>
                    <div>
                      <dt>Available conversions</dt>
                      <dd>{publisher.availableConversions}</dd>
                    </div>
                  </dl>
                  {renderMoveToPendingButton(publisher)}
                </article>
              )
            })}
            {!filteredPublishers.length && (
              <p className={styles.paymentPublisherEmpty}>
                {query ? 'No publishers match your search.' : 'No publishers found.'}
              </p>
            )}
          </div>
          <div className={styles.dataTableWrap}>
            <table className={`${styles.dataTable} ${styles.paymentManagerTable}`}>
              <thead>
                <tr>
                  {['Publisher', 'Status', 'Payment status', 'Binance Pay ID / email', 'Available earnings', 'Pending', 'Total paid', 'Available conversions', 'Action'].map((column, index) => (
                    <th key={column} className={index >= 4 && index <= 7 ? styles.paymentAmount : undefined}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPublishers.map((publisher) => {
                  const payable = isPaymentPayable(publisher.payoutMethod, publisher.payoutAccount)
                  return (
                    <tr key={publisher.id}>
                      <td>
                        <strong>{publisherName(publisher)}</strong>
                        <span className={styles.paymentAccountMeta}>
                          {publisher.publisherNumber == null ? publisher.email : `#${publisher.publisherNumber} · ${publisher.email}`}
                        </span>
                      </td>
                      <td>{publisher.status}</td>
                      <td>
                        <span className={`${styles.paymentReadiness} ${payable ? styles.paymentReadinessPayable : styles.paymentReadinessRequired}`}>
                          {payable ? 'Payable' : 'Payment method required'}
                        </span>
                      </td>
                      <td className={styles.paymentAccountValue}>{publisher.payoutAccount || 'Not set'}</td>
                      <td className={styles.paymentAmount}>{usd.format(publisher.availableEarnings)}</td>
                      <td className={styles.paymentAmount}>{usd.format(publisher.pendingEarnings)}</td>
                      <td className={styles.paymentAmount}>{usd.format(publisher.paidEarnings)}</td>
                      <td className={styles.paymentAmount}>{publisher.availableConversions}</td>
                      <td>{renderMoveToPendingButton(publisher)}</td>
                    </tr>
                  )
                })}
                {!filteredPublishers.length ? <tr><td colSpan={9}>{query ? 'No publishers match your search.' : 'No publishers found.'}</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`${styles.panel} ${styles.dataPage} ${styles.paymentHistory}`}>
          <h2 className={styles.sectionTitle}><i className="fa fa-credit-card" aria-hidden="true" />PENDING INVOICES</h2>
          <div className={styles.paymentMobileCards}>
            {pendingInvoices.map((invoice) => (
              <article className={styles.paymentMobileCard} key={invoice.id}>
                <header className={styles.paymentMobileCardHeader}>
                  <strong className={styles.paymentMobileCardTitle}>{invoice.invoiceNumber}</strong>
                  <span className={styles.paymentMobileCardMeta}>{invoice.conversionCount} conversions</span>
                </header>
                <dl className={styles.paymentMobileCardDetails}>
                  <div>
                    <dt>Publisher</dt>
                    <dd>{invoice.publisher ? publisherName(invoice.publisher) : '—'}</dd>
                  </div>
                  <div className={styles.paymentMobileCardWide}>
                    <dt>Binance Pay ID / email</dt>
                    <dd>{invoice.payoutAccount || 'Not set'}</dd>
                  </div>
                  <div>
                    <dt>Amount</dt>
                    <dd className={styles.paymentMobileCardAmount}>{usd.format(invoice.totalEarning)}</dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>{formatDate(invoice.createdAt)}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  className={styles.pagePrimaryButton}
                  disabled={busyAction === invoice.id}
                  onClick={() => void runManagerAction('mark-paid', invoice.id)}
                >
                  {busyAction === invoice.id ? 'Saving…' : 'Mark paid'}
                </button>
              </article>
            ))}
            {!pendingInvoices.length ? <p className={styles.paymentMobileEmpty}>No pending invoices.</p> : null}
          </div>
          <div className={styles.dataTableWrap}>
            <table className={`${styles.dataTable} ${styles.paymentManagerTable}`}>
              <thead><tr>{['Invoice', 'Publisher', 'Binance Pay ID / email', 'Amount', 'Created', 'Action'].map((column, index) => <th key={column} className={index === 3 ? styles.paymentAmount : undefined}>{column}</th>)}</tr></thead>
              <tbody>
                {pendingInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td><strong>{invoice.invoiceNumber}</strong><span className={styles.paymentAccountMeta}>{invoice.conversionCount} conversions</span></td>
                    <td>{invoice.publisher ? publisherName(invoice.publisher) : '—'}</td>
                    <td className={styles.paymentAccountValue}>{invoice.payoutAccount || 'Not set'}</td>
                    <td className={styles.paymentAmount}>{usd.format(invoice.totalEarning)}</td>
                    <td>{formatDate(invoice.createdAt)}</td>
                    <td>
                      <button
                        type="button"
                        className={styles.pagePrimaryButton}
                        disabled={busyAction === invoice.id}
                        onClick={() => void runManagerAction('mark-paid', invoice.id)}
                      >
                        {busyAction === invoice.id ? 'Saving…' : 'Mark paid'}
                      </button>
                    </td>
                  </tr>
                ))}
                {!pendingInvoices.length ? <tr><td colSpan={6}>No pending invoices.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`${styles.panel} ${styles.dataPage} ${styles.paymentHistory}`}>
          <h2 className={styles.sectionTitle}><i className="fa fa-credit-card" aria-hidden="true" />PAYMENT HISTORY</h2>
          <div className={styles.paymentMobileCards}>
            {data.invoices.map((invoice) => (
              <article className={styles.paymentMobileCard} key={invoice.id}>
                <header className={styles.paymentMobileCardHeader}>
                  <strong className={styles.paymentMobileCardTitle}>{invoice.invoiceNumber}</strong>
                  <span className={`${styles.paymentInvoiceStatus} ${invoice.status === 'PAID' ? styles.paymentInvoicePaid : ''}`}>{invoice.status}</span>
                </header>
                <dl className={styles.paymentMobileCardDetails}>
                  <div>
                    <dt>Publisher</dt>
                    <dd>{invoice.publisher ? publisherName(invoice.publisher) : '—'}</dd>
                  </div>
                  <div>
                    <dt>Amount</dt>
                    <dd className={styles.paymentMobileCardAmount}>{usd.format(invoice.totalEarning)}</dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>{formatDate(invoice.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>Paid</dt>
                    <dd>{formatDate(invoice.paidAt)}</dd>
                  </div>
                </dl>
              </article>
            ))}
            {!data.invoices.length ? <p className={styles.paymentMobileEmpty}>No payment history yet.</p> : null}
          </div>
          <div className={styles.dataTableWrap}>
            <table className={`${styles.dataTable} ${styles.paymentManagerTable}`}>
              <thead><tr>{['Invoice', 'Publisher', 'Amount', 'Status', 'Created', 'Paid'].map((column, index) => <th key={column} className={index === 2 ? styles.paymentAmount : undefined}>{column}</th>)}</tr></thead>
              <tbody>
                {data.invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>{invoice.invoiceNumber}</td>
                    <td>{invoice.publisher ? publisherName(invoice.publisher) : '—'}</td>
                    <td className={styles.paymentAmount}>{usd.format(invoice.totalEarning)}</td>
                    <td><span className={`${styles.paymentInvoiceStatus} ${invoice.status === 'PAID' ? styles.paymentInvoicePaid : ''}`}>{invoice.status}</span></td>
                    <td>{formatDate(invoice.createdAt)}</td>
                    <td>{formatDate(invoice.paidAt)}</td>
                  </tr>
                ))}
                {!data.invoices.length ? <tr><td colSpan={6}>No payment history yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </>
    )
  }

  const payable = isPaymentPayable(data.payout.method, data.payout.account)

  return (
    <>
      <section className={`${styles.panel} ${styles.dataPage} ${styles.paymentInfo}`}>
        <h2 className={styles.sectionTitle}><i className="fa fa-info" aria-hidden="true" />INFO</h2>
        <div className={styles.paymentSummary}>
          <div><strong className={styles.paymentUp}>{usd.format(data.summary.paid)}</strong><span>Total Paid</span></div>
          <div><strong>{usd.format(data.summary.pending)}</strong><span>Pending</span></div>
          <div><strong className={styles.paymentUp}>{usd.format(data.summary.available)}</strong><span>Earnings since last invoice</span></div>
          <div><strong>{data.summary.payments}</strong><span>Total payments</span></div>
        </div>
        {notice ? <p className={styles.pageNotice} role="status">{notice}</p> : null}
        {error ? <p className={styles.paymentError} role="alert">{error}</p> : null}
      </section>

      <section className={`${styles.panel} ${styles.dataPage} ${styles.paymentSettings}`}>
        <div className={`${styles.dataPageHeading} ${styles.paymentSettingsHeading}`}>
          <h2 className={styles.sectionTitle}><i className="fa fa-credit-card" aria-hidden="true" />PAYMENT SETTINGS</h2>
          {payable ? (
            <span className={`${styles.paymentReadiness} ${styles.paymentReadinessPayable}`} aria-label="Payment status: payable">
              Payable
            </span>
          ) : null}
        </div>
        <div className={styles.binancePayCard}>
          <svg
            className={styles.binanceLogo}
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <path
              fill="currentColor"
              d="M16.624 13.9202l2.7175 2.7154-7.353 7.353-7.353-7.352 2.7175-2.7164 4.6355 4.6595 4.6356-4.6595zm4.6366-4.6366L24 12l-2.7154 2.7164L18.5682 12l2.6924-2.7164zm-9.272.001l2.7163 2.6914-2.7164 2.7174v-.001L9.2721 12l2.7164-2.7154zm-9.2722-.001L5.4088 12l-2.6914 2.6924L0 12l2.7164-2.7164zM11.9885.0115l7.353 7.329-2.7174 2.7154-4.6356-4.6356-4.6355 4.6595-2.7174-2.7154 7.353-7.353z"
            />
          </svg>
          <span className={styles.binancePayBrand}>
            <strong>Binance Pay</strong>
            <small>USDT payout method</small>
          </span>
          <span className={styles.binancePayAsset}>USDT</span>
        </div>
        <form className={`${styles.dataForm} ${styles.paymentPayoutForm}`} onSubmit={savePayoutDetails}>
          <label className={styles.dataField} htmlFor="binance-pay-account">
            Binance Pay ID or Binance account email
            <input
              id="binance-pay-account"
              type="text"
              autoComplete="off"
              maxLength={200}
              aria-describedby="binance-pay-account-hint"
              value={accountDraft}
              onChange={(event) => setAccountDraft(event.target.value)}
              placeholder="Enter your Binance Pay ID or email"
              required
            />
            <small id="binance-pay-account-hint" className={styles.binancePayHint}>
              Use the ID or email linked to your Binance account.
            </small>
          </label>
          <button type="submit" className={styles.pagePrimaryButton} disabled={busyAction === 'save' || !accountDraft.trim()}>
            {busyAction === 'save' ? 'Saving…' : 'Save payout details'}
          </button>
        </form>
      </section>

      <section className={`${styles.panel} ${styles.dataPage} ${styles.paymentHistory}`}>
        <h2 className={styles.sectionTitle}><i className="fa fa-credit-card" aria-hidden="true" />PAYMENT HISTORY</h2>
        <div className={styles.paymentMobileCards}>
          {data.invoices.map((invoice) => (
            <article className={styles.paymentMobileCard} key={invoice.id}>
              <header className={styles.paymentMobileCardHeader}>
                <strong className={styles.paymentMobileCardTitle}>{invoice.invoiceNumber}</strong>
                <span className={`${styles.paymentInvoiceStatus} ${invoice.status === 'PAID' ? styles.paymentInvoicePaid : ''}`}>{invoice.status}</span>
              </header>
              <dl className={styles.paymentMobileCardDetails}>
                <div>
                  <dt>Invoice date</dt>
                  <dd>{formatDate(invoice.createdAt)}</dd>
                </div>
                <div>
                  <dt>Amount paid</dt>
                  <dd className={styles.paymentMobileCardAmount}>{usd.format(invoice.totalEarning)}</dd>
                </div>
                <div>
                  <dt>Method</dt>
                  <dd>Binance Pay</dd>
                </div>
              </dl>
            </article>
          ))}
          {!data.invoices.length ? <p className={styles.paymentMobileEmpty}>No payments yet.</p> : null}
        </div>
        <div className={styles.dataTableWrap}>
          <table className={styles.dataTable}>
            <thead>
              <tr>{['Invoice date', 'Amount Paid', 'Method', 'Status', 'Invoice'].map((column, index) => <th key={column} className={index === 1 ? styles.paymentAmount : undefined}>{column}</th>)}</tr>
            </thead>
            <tbody>
              {data.invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{formatDate(invoice.createdAt)}</td>
                  <td className={styles.paymentAmount}>{usd.format(invoice.totalEarning)}</td>
                  <td>Binance Pay</td>
                  <td><span className={`${styles.paymentInvoiceStatus} ${invoice.status === 'PAID' ? styles.paymentInvoicePaid : ''}`}>{invoice.status}</span></td>
                  <td>{invoice.invoiceNumber}</td>
                </tr>
              ))}
              {!data.invoices.length ? <tr><td colSpan={5}>No payments yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className={styles.reportPagination}><div><button type="button" disabled>Previous</button><button type="button" disabled>Next</button></div></div>
      </section>
    </>
  )
}
