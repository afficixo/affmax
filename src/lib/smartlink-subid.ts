import { randomInt } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import {
  formatSmartlinkSubId,
  isPublisherSmartlinkSubId,
  PUBLISHER_SMARTLINK_KIND,
} from '@/lib/smartlink'

const SUBID_SPACE_SIZE = 0x100000
const MAX_SUBID_ATTEMPTS = 16

export function generatePublisherSmartlinkSubId() {
  return formatSmartlinkSubId(randomInt(SUBID_SPACE_SIZE))
}

export async function ensurePublisherSmartlinkSubId(
  smartlinkId: string,
  currentSubId?: string | null,
): Promise<string | null> {
  if (currentSubId !== undefined && currentSubId !== null) {
    if (!isPublisherSmartlinkSubId(currentSubId)) {
      throw new Error('Stored Smartlink SubID is not a five-digit hexadecimal value')
    }
    return currentSubId
  }

  for (let attempt = 0; attempt < MAX_SUBID_ATTEMPTS; attempt += 1) {
    const publisherSubId = generatePublisherSmartlinkSubId()
    try {
      const updated = await prisma.incentiveTool.updateMany({
        where: {
          id: smartlinkId,
          kind: PUBLISHER_SMARTLINK_KIND,
          publisherSubId: null,
        },
        data: { publisherSubId },
      })
      if (updated.count) return publisherSubId

      const existing = await prisma.incentiveTool.findUnique({
        where: { id: smartlinkId },
        select: { kind: true, publisherSubId: true },
      })
      if (!existing || existing.kind !== PUBLISHER_SMARTLINK_KIND) return null
      if (existing.publisherSubId !== null) {
        if (!isPublisherSmartlinkSubId(existing.publisherSubId)) {
          throw new Error('Stored Smartlink SubID is not a five-digit hexadecimal value')
        }
        return existing.publisherSubId
      }
    } catch (error) {
      const isPublisherSubIdCollision = error instanceof Prisma.PrismaClientKnownRequestError
        && error.code === 'P2002'
      if (!isPublisherSubIdCollision || attempt === MAX_SUBID_ATTEMPTS - 1) throw error
    }
  }

  throw new Error('Unable to allocate a unique Smartlink SubID')
}
