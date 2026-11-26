ALTER TABLE "campaign_offers" ADD COLUMN "marketplaceOfferId" TEXT;
CREATE UNIQUE INDEX "campaign_offers_marketplaceOfferId_key" ON "campaign_offers"("marketplaceOfferId");

ALTER TABLE "conversion_leads" ADD COLUMN "publisherSub3" TEXT;
