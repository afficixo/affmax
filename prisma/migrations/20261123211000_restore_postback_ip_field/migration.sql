ALTER TABLE "postback_configs"
  ADD COLUMN IF NOT EXISTS "ipToken" TEXT NOT NULL DEFAULT '#ip#';
