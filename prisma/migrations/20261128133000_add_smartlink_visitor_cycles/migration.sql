CREATE TABLE "smartlink_visitor_cycles" (
    "smartlinkId" TEXT NOT NULL,
    "visitorHash" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "seenOfferIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "smartlink_visitor_cycles_pkey" PRIMARY KEY ("smartlinkId", "visitorHash", "countryCode")
);

CREATE INDEX "smartlink_visitor_cycles_updatedAt_idx" ON "smartlink_visitor_cycles"("updatedAt");

ALTER TABLE "smartlink_visitor_cycles"
ADD CONSTRAINT "smartlink_visitor_cycles_smartlinkId_fkey"
FOREIGN KEY ("smartlinkId") REFERENCES "incentive_tools"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
