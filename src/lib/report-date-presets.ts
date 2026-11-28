export type ReportDatePreset = {
  label: string
  days: number | 'month' | 'last-month' | 'all-time'
  span?: number
}

export const reportRangePresets = [
  { label: 'Today', days: 0 },
  { label: 'Yesterday', days: 1, span: 0 },
  { label: 'Last 7 Days', days: 6 },
  { label: 'Last 30 Days', days: 29 },
  { label: 'This Month', days: 'month' as const },
  { label: 'Last Month', days: 'last-month' as const },
] as const

export const allTimeReportPreset = { label: 'All Time', days: 'all-time' } as const
