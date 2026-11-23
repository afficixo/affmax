ALTER TABLE "conversion_leads"
  ALTER COLUMN "postbackId" DROP NOT NULL;

ALTER TABLE "conversion_leads"
  DROP CONSTRAINT IF EXISTS "conversion_leads_postbackId_fkey";

ALTER TABLE "conversion_leads"
  ADD CONSTRAINT "conversion_leads_postbackId_fkey"
  FOREIGN KEY ("postbackId") REFERENCES "postback_configs"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
