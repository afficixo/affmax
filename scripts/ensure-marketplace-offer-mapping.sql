ALTER TABLE IF EXISTS "campaign_offers" ADD COLUMN IF NOT EXISTS "marketplaceOfferId" TEXT;

DO $$
BEGIN
  IF to_regclass('public.campaign_offers') IS NOT NULL THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS "campaign_offers_marketplaceOfferId_key"
      ON "campaign_offers"("marketplaceOfferId")';
  END IF;
END $$;

ALTER TABLE IF EXISTS "conversion_leads" ADD COLUMN IF NOT EXISTS "publisherSub3" TEXT;
