ALTER TABLE "offer_clicks"
ADD COLUMN "smartlinkId" TEXT;

CREATE INDEX "offer_clicks_publisherNumber_smartlinkId_createdAt_idx"
ON "offer_clicks"("publisherNumber", "smartlinkId", "createdAt");

ALTER TABLE "offer_clicks"
ADD CONSTRAINT "offer_clicks_smartlinkId_fkey"
FOREIGN KEY ("smartlinkId") REFERENCES "incentive_tools"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
