ALTER TABLE IF EXISTS "postback_configs"
  DROP COLUMN IF EXISTS "datetimeToken",
  DROP COLUMN IF EXISTS "countryToken";
