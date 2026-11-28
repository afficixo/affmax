'use client'

import { useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import ReportDateRangePicker from '@/components/dashboard/ReportDateRangePicker'
import dashboardStyles from '@/components/dashboard/Dashboard.module.css'
import { allTimeReportPreset, reportRangePresets } from '@/lib/report-date-presets'

type SmartlinkReportDateFilterProps = {
  startDate: string
  endDate: string
  presetLabel: string
}

function formatReportDateLabel(value: string) {
  const date = new Date(`${value}T12:00:00Z`)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

export default function SmartlinkReportDateFilter({
  startDate,
  endDate,
  presetLabel,
}: SmartlinkReportDateFilterProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const presets = [allTimeReportPreset, ...reportRangePresets]
  const rangeValue = presetLabel === 'All Time'
    ? 'All Time'
    : `${formatReportDateLabel(startDate)} - ${formatReportDateLabel(endDate)}`

  const applyRange = (start: string, end: string, nextPreset: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('from')
    params.delete('to')
    params.delete('preset')
    params.delete('allTime')
    if (nextPreset === 'All Time') {
      params.set('allTime', '1')
    } else {
      params.set('from', start)
      params.set('to', end)
      params.set('preset', nextPreset)
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
    setOpen(false)
  }

  return (
    <div className={dashboardStyles.reportDatePicker}>
      <input
        ref={inputRef}
        type="text"
        readOnly
        id="reportrange"
        role="combobox"
        className={dashboardStyles.reportRangeInput}
        value={rangeValue}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="report-date-range-picker-dialog"
        aria-label="Report date range"
        onClick={() => setOpen((current) => !current)}
      />
      {open ? (
        <ReportDateRangePicker
          startDate={startDate}
          endDate={endDate}
          presetLabel={presetLabel}
          presets={presets}
          anchorRef={inputRef}
          onApply={applyRange}
          onCancel={() => setOpen(false)}
        />
      ) : null}
    </div>
  )
}
