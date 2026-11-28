'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import dashboardStyles from '@/components/dashboard/Dashboard.module.css'
import { publisherSmartlinkTrackingCode } from '@/lib/smartlink'
import { getTrackingDomainOrigin } from '@/lib/tracking'

type SmartlinkCopyButtonProps = {
  smartlinkId: string
  smartlinkName: string
}

export default function SmartlinkCopyButton({
  smartlinkId,
  smartlinkName,
}: SmartlinkCopyButtonProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')

  const copyTrackingLink = async () => {
    const origin = getTrackingDomainOrigin() || window.location.origin
    const url = `${origin.replace(/\/$/, '')}/${publisherSmartlinkTrackingCode(smartlinkId)}`

    try {
      await navigator.clipboard.writeText(url)
      setCopyStatus('copied')
    } catch (error) {
      console.error('Unable to copy public Smartlink:', error)
      setCopyStatus('failed')
    }
  }

  const label = copyStatus === 'copied'
    ? 'Copied'
    : copyStatus === 'failed'
      ? 'Copy failed'
      : 'Copy link'

  return (
    <button
      type="button"
      className={dashboardStyles.publisherSmartlinkCopy}
      onClick={() => void copyTrackingLink()}
      aria-label={`${label} ${smartlinkName} tracking link`}
      aria-live="polite"
    >
      {copyStatus === 'copied'
        ? <Check size={14} aria-hidden="true" />
        : <Copy size={14} aria-hidden="true" />}
      {label}
    </button>
  )
}
