ALTER TABLE "offer_clicks"
  ADD COLUMN IF NOT EXISTS "isUnique" BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS "offer_clicks_publisherNumber_offerId_createdAt_idx"
  ON "offer_clicks"("publisherNumber", "offerId", "createdAt");

UPDATE "offer_clicks" AS current_click
SET "isUnique" = NOT EXISTS (
  SELECT 1
  FROM "offer_clicks" AS previous_click
  WHERE previous_click."publisherNumber" = current_click."publisherNumber"
    AND previous_click."offerId" = current_click."offerId"
    AND previous_click."createdAt" >= current_click."createdAt" - INTERVAL '24 hours'
    AND (
      previous_click."createdAt" < current_click."createdAt"
      OR (
        previous_click."createdAt" = current_click."createdAt"
        AND previous_click."id" < current_click."id"
      )
    )
    AND (
      (
        current_click."ipAddress" IS NOT NULL
        AND current_click."ipAddress" <> ''
        AND previous_click."ipAddress" = current_click."ipAddress"
      )
      OR (
        current_click."userAgent" IS NOT NULL
        AND current_click."userAgent" <> ''
        AND previous_click."userAgent" = current_click."userAgent"
      )
    )
);
