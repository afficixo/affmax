import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db/prisma'
import { PUBLISHER_SMARTLINK_KIND } from '@/lib/smartlink'
import SmartlinkReportView from '@/app/smartlink/[id]/report/SmartlinkReportView'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Smartlink Geo Report | Crack Bounty',
  robots: { index: false, follow: false },
}

type GeoReportPageProps = {
  params: Promise<{ code: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function GeoReportPage({ params, searchParams }: GeoReportPageProps) {
  const { code } = await params
  if (!/^[0-9a-f]{8}$/i.test(code)) notFound()

  const matches = await prisma.incentiveTool.findMany({
    where: {
      id: { startsWith: code.toLowerCase() },
      kind: PUBLISHER_SMARTLINK_KIND,
      isPublished: true,
    },
    select: { id: true },
    take: 2,
  })
  if (matches.length !== 1) notFound()
  const [smartlink] = matches
  if (!smartlink) notFound()

  return <SmartlinkReportView id={smartlink.id} searchParams={searchParams} />
}
