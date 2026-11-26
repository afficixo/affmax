ALTER TABLE "campaign_offers" ADD COLUMN IF NOT EXISTS "marketplaceOfferId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "campaign_offers_marketplaceOfferId_key" ON "campaign_offers"("marketplaceOfferId");
ALTER TABLE "conversion_leads" ADD COLUMN IF NOT EXISTS "publisherSub3" TEXT;
