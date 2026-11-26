'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Mail, Plus, Send, Trash2, X } from 'lucide-react'
import styles from './Dashboard.module.css'

type NewsPost = {
  id: string
  title: string
  body: string
  createdAt: string
  authorName: string
}

type NewsUpdatesPopoverProps = {
  isOpen: boolean
  isManager: boolean
  onToggle: () => void
}

function formatPostDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

export default function NewsUpdatesPopover({
  isOpen,
  isManager,
  onToggle,
}: NewsUpdatesPopoverProps) {
  const [posts, setPosts] = useState<NewsPost[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const defaultNews = isManager
    ? [
        {
          label: 'CAMPAIGN MANAGEMENT',
          title: 'Manage your catalog',
          body: 'Add and update offers from Campaigns or Incentive Offers.',
        },
        {
          label: 'SUPPORT',
          title: 'Need help?',
          body: 'Use Support to manage publisher conversations and answer questions.',
        },
      ]
    : [
        {
          label: 'GETTING STARTED',
          title: 'Welcome',
          body: 'Your catalog is ready. Add offers from Campaigns or Incentive Offers to start promoting.',
        },
        {
          label: 'SUPPORT',
          title: 'Need help?',
          body: 'Contact your affiliate manager anytime if you need assistance with offers or payouts.',
        },
      ]

  useEffect(() => {
    if (!isOpen) return

    let active = true
    setIsLoading(true)
    setError('')

    void fetch('/api/dashboard-news', { credentials: 'include', cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json() as { posts?: NewsPost[]; error?: string }
        if (!response.ok) throw new Error(data.error || 'Unable to load news and updates')
        if (!Array.isArray(data.posts)) throw new Error('The news response was invalid')
        if (active) setPosts(data.posts)
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load news and updates')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [isOpen])

  async function createPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSaving) return

    setIsSaving(true)
    setError('')
    setStatus('')
    try {
      const response = await fetch('/api/dashboard-news', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body }),
      })
      const data = await response.json() as { post?: NewsPost; error?: string }
      if (!response.ok) throw new Error(data.error || 'Unable to publish update')
      const createdPost = data.post
      if (!createdPost) throw new Error('The published update was not returned')

      setPosts((current) => [createdPost, ...current])
      setTitle('')
      setBody('')
      setIsComposerOpen(false)
      setStatus('Update published for all publishers.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to publish update')
    } finally {
      setIsSaving(false)
    }
  }

  async function deletePost(post: NewsPost) {
    if (deletingPostId || !window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return

    setDeletingPostId(post.id)
    setError('')
    setStatus('')
    try {
      const response = await fetch(`/api/dashboard-news?id=${encodeURIComponent(post.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await response.json() as { error?: string }
      if (!response.ok) throw new Error(data.error || 'Unable to remove update')

      setPosts((current) => current.filter((item) => item.id !== post.id))
      setStatus('Update removed.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to remove update')
    } finally {
      setDeletingPostId(null)
    }
  }

  return (
    <div className={styles.popoverWrap}>
      <button
        type="button"
        className={styles.iconButton}
        aria-label="News and notifications"
        aria-expanded={isOpen}
        aria-controls={isOpen ? 'dashboard-news-popover' : undefined}
        onClick={onToggle}
      >
        <Mail size={16} />
      </button>
      {isOpen && (
        <section
          id="dashboard-news-popover"
          className={`${styles.popover} ${styles.newsPopover} ${isManager ? styles.newsPopoverManager : ''}`}
          aria-label="News and updates"
        >
          {isManager ? (
            <div className={styles.newsPopoverHeader}>
              <div>
                <span className={styles.newsEyebrow}>STAY IN THE LOOP</span>
                <h2>News &amp; updates</h2>
              </div>
              <button
                type="button"
                className={styles.newsComposeToggle}
                aria-expanded={isComposerOpen}
                onClick={() => {
                  setIsComposerOpen((open) => !open)
                  setError('')
                }}
              >
                {isComposerOpen ? <X size={15} /> : <Plus size={15} />}
                {isComposerOpen ? 'Close' : 'New post'}
              </button>
            </div>
          ) : (
            <div className={styles.popoverTitle}>NEWS &amp; UPDATES</div>
          )}

          <div className={isManager ? styles.newsListManager : styles.newsListPublisher}>
            {isComposerOpen && isManager && (
              <form className={styles.newsComposer} onSubmit={createPost}>
                <div className={styles.newsComposerHeading}>
                  <strong>Write an update</strong>
                  <span>Visible to all publishers</span>
                </div>
                <label className={styles.newsField}>
                  <span>Title</span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={80}
                    placeholder="What should publishers know?"
                    required
                  />
                </label>
                <label className={styles.newsField}>
                  <span>Message</span>
                  <textarea
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    maxLength={600}
                    rows={4}
                    placeholder="Share an offer update, reminder, or important news..."
                    required
                  />
                </label>
                <div className={styles.newsComposerFooter}>
                  <span>{body.length}/600</span>
                  <button type="submit" className={styles.newsPublishButton} disabled={isSaving || !title.trim() || !body.trim()}>
                    <Send size={14} />
                    {isSaving ? 'Publishing…' : 'Publish update'}
                  </button>
                </div>
              </form>
            )}

            {error && <p className={styles.newsError} role="alert">{error}</p>}
            {isManager && status && <p className={styles.newsStatus} role="status">{status}</p>}
            {isManager && isLoading && <p className={styles.newsLoading}>Loading updates…</p>}
            {isManager && !isLoading && !error && posts.length === 0 && (
              <div className={styles.newsEmptyState}>
                <span className={styles.newsEmptyIcon}><Mail size={17} /></span>
                <strong>{isManager ? 'No updates yet' : 'No manager updates yet'}</strong>
                <p>{isManager
                  ? 'Publish your first update so all publishers can see it here.'
                  : 'New announcements from your affiliate manager will appear here.'}</p>
              </div>
            )}
            {posts.map((post) => isManager ? (
              <article className={styles.newsPost} key={post.id}>
                <div className={styles.newsPostMeta}>
                  <span>MANAGER UPDATE</span>
                  {post.createdAt && <time dateTime={post.createdAt}>{formatPostDate(post.createdAt)}</time>}
                </div>
                <div className={styles.newsPostHeading}>
                  <h3>{post.title}</h3>
                  <button
                    type="button"
                    className={styles.newsDeleteButton}
                    aria-label={`${deletingPostId === post.id ? 'Deleting' : 'Delete'} update: ${post.title}`}
                    title={deletingPostId === post.id ? 'Deleting update…' : 'Delete update'}
                    disabled={deletingPostId !== null}
                    aria-busy={deletingPostId === post.id}
                    onClick={() => void deletePost(post)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
                <p className={styles.newsPostBody}>{post.body}</p>
                <span className={styles.newsAuthor}>Posted by {post.authorName}</span>
              </article>
            ) : (
              <article className={styles.newsPublisherPost} key={post.id}>
                <strong>{post.title}</strong>
                <p>{post.body}</p>
              </article>
            ))}

            {isManager && <div className={styles.newsStaticHeading}>FROM YOUR DASHBOARD</div>}
            {defaultNews.map((item) => isManager ? (
              <article className={styles.newsInfoPost} key={item.title}>
                <span className={styles.newsInfoLabel}>{item.label}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ) : (
              <article className={styles.newsPublisherPost} key={item.title}>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
