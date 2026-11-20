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

export default function PaymentDashboard() {
  const [data, setData] = useState<PaymentsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [accountDraft, setAccountDraft] = useState('')
  const [publisherSearch, setPublisherSearch] = useState('')
  const [busyAction, setBusyAction] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const loadPayments = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/payments', { credentials: 'include', cache: 'no-store' })
      const result = await response.json() as PaymentsData & { error?: string }
      if (!response.ok) throw new Error(result.error || 'Unable to load payment data')
      setData(result)
      if (result.role === 'PUBLISHER') setAccountDraft(result.payout.account)
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
      setNotice(action === 'move-to-pending' ? 'Publisher earnings through Monday moved to pending.' : 'Invoice marked as paid.')
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
      <div className={styles.paymentLoading} role="status" aria-live="polite" aria-busy="true">
        <span className={styles.paymentLoadingAnnounce}>Loading payment details</span>
        <section className={`${styles.panel} ${styles.dataPage} ${styles.paymentInfo}`} aria-hidden="true">
          <h2 className={styles.sectionTitle}><i className="fa fa-info" aria-hidden="true" />INFO</h2>
          <div className={styles.paymentSummary}>
            {[0, 1, 2, 3].map((item) => (
              <div key={item}>
                <span className={`${styles.paymentSkeleton} ${styles.paymentSkeletonValue}`} />
                <span className={`${styles.paymentSkeleton} ${styles.paymentSkeletonLabel}`} />
              </div>
            ))}
          </div>
          {[0, 1, 2].map((item) => (
            <section className={styles.paymentInfoSection} key={item}>
              <span className={`${styles.paymentSkeleton} ${styles.paymentSkeletonHeading}`} />
              <span className={`${styles.paymentSkeleton} ${styles.paymentSkeletonLine}`} />
              <span className={`${styles.paymentSkeleton} ${styles.paymentSkeletonLine}`} />
            </section>
          ))}
        </section>
        <section className={`${styles.panel} ${styles.dataPage} ${styles.paymentSettings}`} aria-hidden="true">
          <h2 className={styles.sectionTitle}><i className="fa fa-credit-card" aria-hidden="true" />PAYMENT SETTINGS</h2>
          <span className={`${styles.paymentSkeleton} ${styles.paymentSkeletonField}`} />
        </section>
        <section className={`${styles.panel} ${styles.dataPage} ${styles.paymentHistory}`} aria-hidden="true">
          <h2 className={styles.sectionTitle}><i className="fa fa-credit-card" aria-hidden="true" />PAYMENT HISTORY</h2>
          <div className={styles.dataTableWrap}>
            <table className={styles.dataTable}>
              <thead><tr>{[0, 1, 2, 3, 4].map((item) => <th key={item}><span className={`${styles.paymentSkeleton} ${styles.paymentSkeletonTableHeading}`} /></th>)}</tr></thead>
              <tbody>
                {[0, 1, 2].map((row) => (
                  <tr key={row}>{[0, 1, 2, 3, 4].map((cell) => <td key={cell}><span className={`${styles.paymentSkeleton} ${styles.paymentSkeletonTableCell}`} /></td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
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
    return (
      <>
        <section className={`${styles.panel} ${styles.dataPage} ${styles.paymentInfo}`}>
          <h2 className={styles.sectionTitle}><i className="fa fa-info" aria-hidden="true" />PUBLISHER PAYMENTS</h2>
          <div className={styles.paymentSummary}>
            <div><strong>{data.summary.publishers}</strong><span>Publishers</span></div>
            <div><strong>{usd.format(data.summary.pending)}</strong><span>Pending</span></div>
            <div><strong>{usd.format(data.summary.available)}</strong><span>Earnings through Monday</span></div>
            <div><strong>{usd.format(data.summary.paid)}</strong><span>Total paid</span></div>
          </div>
          <section className={styles.paymentInfoSection}>
            <p>Move each publisher&apos;s un-invoiced earnings through the most recent Monday to pending, including earnings from earlier weeks. Monday is based on server-local time; earnings after that Monday are not included. All earnings, invoices, and payment totals are calculated in USD; transfers are not sent automatically.</p>
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
          <div className={styles.dataTableWrap}>
            <table className={`${styles.dataTable} ${styles.paymentManagerTable}`}>
              <thead>
                <tr>
                  {['Publisher', 'Status', 'Binance Pay ID / email', 'Earnings through Monday', 'Pending', 'Total paid', 'Conversions through Monday', 'Action'].map((column, index) => (
                    <th key={column} className={index >= 3 && index <= 6 ? styles.paymentAmount : undefined}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPublishers.map((publisher) => (
                  <tr key={publisher.id}>
                    <td>
                      <strong>{publisherName(publisher)}</strong>
                      <span className={styles.paymentAccountMeta}>
                        {publisher.publisherNumber == null ? publisher.email : `#${publisher.publisherNumber} · ${publisher.email}`}
                      </span>
                    </td>
                    <td>{publisher.status}</td>
                    <td className={styles.paymentAccountValue}>{publisher.payoutAccount || 'Not set'}</td>
                    <td className={styles.paymentAmount}>{usd.format(publisher.availableEarnings)}</td>
                    <td className={styles.paymentAmount}>{usd.format(publisher.pendingEarnings)}</td>
                    <td className={styles.paymentAmount}>{usd.format(publisher.paidEarnings)}</td>
                    <td className={styles.paymentAmount}>{publisher.availableConversions}</td>
                    <td>
                      <button
                        type="button"
                        className={styles.pagePrimaryButton}
                        disabled={!publisher.availableEarnings
                          || publisher.payoutMethod !== 'BINANCE_PAY_USDT'
                          || !publisher.payoutAccount?.trim()
                          || busyAction === publisher.id}
                        onClick={() => void runManagerAction('move-to-pending', publisher.id)}
                        title={!publisher.payoutAccount?.trim() || publisher.payoutMethod !== 'BINANCE_PAY_USDT'
                          ? 'Publisher must save their Binance Pay ID or account email before earnings can be moved to pending'
                          : undefined}
                      >
                        {busyAction === publisher.id ? 'Moving…' : 'Move to pending'}
                      </button>
                    </td>
                  </tr>
                ))}
                {!filteredPublishers.length ? <tr><td colSpan={8}>{query ? 'No publishers match your search.' : 'No publishers found.'}</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`${styles.panel} ${styles.dataPage} ${styles.paymentHistory}`}>
          <h2 className={styles.sectionTitle}><i className="fa fa-credit-card" aria-hidden="true" />PENDING INVOICES</h2>
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
                {!pendingInvoices.length ? <tr><td colSpan={6}>No data available</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`${styles.panel} ${styles.dataPage} ${styles.paymentHistory}`}>
          <h2 className={styles.sectionTitle}><i className="fa fa-credit-card" aria-hidden="true" />PAYMENT HISTORY</h2>
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
                {!data.invoices.length ? <tr><td colSpan={6}>No data available</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </>
    )
  }

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
        <section className={styles.paymentInfoSection}>
          <h2>Payment Process</h2>
          <p>Approved conversion earnings remain available until your manager moves them to pending. Payments are recorded after your manager sends funds through Binance Pay.</p>
        </section>
        <section className={styles.paymentInfoSection}>
          <h2>Payment Details</h2>
          <p>Payouts are sent to your saved Binance Pay ID or Binance account email. All earnings, pending invoices, and payment history are calculated in USD.</p>
        </section>
        <section className={styles.paymentInfoSection}>
          <h2>Tax Forms</h2>
          <p>Tax form is based on the country of your residency and whether you are an individual or business. Please use the correct form as it is really important, see instructions below:</p>
          <ul>
            <li>For Non-US individuals - complete W-8BEN form</li>
            <li>For Non-US businesses - complete W-8BEN-E form</li>
            <li>For USA individuals and businesses - complete W-9 form</li>
          </ul>
        </section>
        <section className={`${styles.paymentInfoSection} ${styles.payoneerNotice}`}>
          <h2>Binance Pay <span>IMPORTANT!</span> <b>USD TRACKING</b></h2>
          <p>Your manager handles any USDT transfer outside the app; the payment record remains in USD. Saving a payout destination does not initiate a transfer.</p>
        </section>
        {notice ? <p className={styles.pageNotice} role="status">{notice}</p> : null}
        {error ? <p className={styles.paymentError} role="alert">{error}</p> : null}
      </section>

      <section className={`${styles.panel} ${styles.dataPage} ${styles.paymentSettings}`}>
        <h2 className={styles.sectionTitle}><i className="fa fa-credit-card" aria-hidden="true" />PAYMENT SETTINGS</h2>
        <form className={`${styles.dataForm} ${styles.paymentPayoutForm}`} onSubmit={savePayoutDetails}>
          <label className={styles.dataField} htmlFor="binance-pay-account">
            Binance Pay ID or Binance account email
            <input
              id="binance-pay-account"
              type="text"
              autoComplete="off"
              maxLength={200}
              value={accountDraft}
              onChange={(event) => setAccountDraft(event.target.value)}
              placeholder="Enter your Binance Pay ID or email"
              required
            />
          </label>
          <p className={styles.pageHint}>Managers can view this payout destination. All payment amounts remain calculated in USD.</p>
          <button type="submit" className={styles.pagePrimaryButton} disabled={busyAction === 'save' || !accountDraft.trim()}>
            {busyAction === 'save' ? 'Saving…' : 'Save payout details'}
          </button>
        </form>
      </section>

      <section className={`${styles.panel} ${styles.dataPage} ${styles.paymentHistory}`}>
        <h2 className={styles.sectionTitle}><i className="fa fa-credit-card" aria-hidden="true" />PAYMENT HISTORY</h2>
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
              {!data.invoices.length ? <tr><td colSpan={5}>No data available</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className={styles.reportPagination}><div><button type="button" disabled>Previous</button><button type="button" disabled>Next</button></div></div>
      </section>
    </>
  )
}
