import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import SmartlinkReportView from './SmartlinkReportView'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Smartlink Geo Report | Crack Bounty',
  robots: { index: false, follow: false },
}

type SmartlinkReportPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function SmartlinkReportPage({ params, searchParams }: SmartlinkReportPageProps) {
  const { id } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    notFound()
  }

  return <SmartlinkReportView id={id} searchParams={searchParams} />
}
