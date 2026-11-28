type OfferClickDedupeInput = {
  publisherNumber: number
  offerId: string
  smartlinkId?: string | null
  ipAddress: string | null
  userAgent: string | null
  windowStart: Date
}

export function buildOfferClickDuplicateWhere(input: OfferClickDedupeInput) {
  if (input.smartlinkId) {
    if (!input.ipAddress || !input.userAgent) return null
    return {
      publisherNumber: input.publisherNumber,
      smartlinkId: input.smartlinkId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      createdAt: { gte: input.windowStart },
    }
  }

  const duplicateConditions = [
    ...(input.ipAddress ? [{ ipAddress: input.ipAddress }] : []),
    ...(input.userAgent ? [{ userAgent: input.userAgent }] : []),
  ]
  if (!duplicateConditions.length) return null

  return {
    publisherNumber: input.publisherNumber,
    offerId: input.offerId,
    smartlinkId: null,
    createdAt: { gte: input.windowStart },
    OR: duplicateConditions,
  }
}
