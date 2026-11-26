ALTER TABLE "postback_configs"
  ADD COLUMN IF NOT EXISTS "cmpidToken" TEXT NOT NULL DEFAULT '#cmpid#';
