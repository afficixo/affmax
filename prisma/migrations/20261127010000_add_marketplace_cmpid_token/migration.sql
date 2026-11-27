ALTER TABLE IF EXISTS "postback_configs"
  ADD COLUMN IF NOT EXISTS "cmpidToken" TEXT NOT NULL DEFAULT '#cmpid#';
