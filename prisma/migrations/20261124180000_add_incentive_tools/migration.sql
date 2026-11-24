CREATE TABLE "incentive_tools" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "toggles" JSONB NOT NULL,
    "selectedOfferIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incentive_tools_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "incentive_tools_ownerId_kind_idx" ON "incentive_tools"("ownerId", "kind");
CREATE INDEX "incentive_tools_kind_isPublished_idx" ON "incentive_tools"("kind", "isPublished");

ALTER TABLE "incentive_tools"
ADD CONSTRAINT "incentive_tools_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
