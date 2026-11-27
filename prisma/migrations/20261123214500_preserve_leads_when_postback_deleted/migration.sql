DO $$
BEGIN
  IF to_regclass('public.conversion_leads') IS NOT NULL
     AND to_regclass('public.postback_configs') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "conversion_leads" ALTER COLUMN "postbackId" DROP NOT NULL';
    EXECUTE 'ALTER TABLE "conversion_leads" DROP CONSTRAINT IF EXISTS "conversion_leads_postbackId_fkey"';
    EXECUTE 'ALTER TABLE "conversion_leads" ADD CONSTRAINT "conversion_leads_postbackId_fkey"
      FOREIGN KEY ("postbackId") REFERENCES "postback_configs"("id")
      ON DELETE SET NULL ON UPDATE CASCADE';
  END IF;
END $$;
