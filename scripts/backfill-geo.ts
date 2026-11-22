import { prisma } from '../src/lib/db/prisma'
import { lookupCountryCode } from '../src/lib/ip2location'

async function main() {
  const useProviderIpFallback = process.env.GEO_BACKFILL_PROVIDER_IP_FALLBACK === '1'
  if (useProviderIpFallback && process.env.NODE_ENV === 'production') {
    throw new Error('Provider-IP fallback is not allowed in production')
  }

  const clicks = await prisma.offerClick.findMany({
    where: {
      countryCode: null,
      ipAddress: { not: null },
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, ipAddress: true },
  })

  let updated = 0
  let unresolved = 0
  for (const click of clicks) {
    const countryCode = await lookupCountryCode(click.ipAddress, { useProviderIpFallback })
    if (!countryCode) {
      unresolved += 1
      continue
    }

    await prisma.offerClick.update({
      where: { id: click.id },
      data: { countryCode },
    })
    updated += 1
  }

  console.info(`Geo backfill complete: ${updated} updated, ${unresolved} unresolved.`)
}

main()
  .catch((error) => {
    console.error('Geo backfill failed:', error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
