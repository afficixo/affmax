DO $$
BEGIN
    IF (SELECT COUNT(*) FROM "incentive_tools" WHERE "kind" = 'publisher-smartlink') > 1048576 THEN
        RAISE EXCEPTION 'Cannot assign unique five-digit hexadecimal Smartlink SubIDs: capacity exceeded';
    END IF;
END $$;

ALTER TABLE "incentive_tools"
ADD COLUMN "publisherSubId" TEXT;

WITH numbered_smartlinks AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (ORDER BY "createdAt", "id") - 1 AS "number"
    FROM "incentive_tools"
    WHERE "kind" = 'publisher-smartlink'
)
UPDATE "incentive_tools" AS tools
SET "publisherSubId" = LPAD(UPPER(TO_HEX(numbered_smartlinks."number")), 5, '0')
FROM numbered_smartlinks
WHERE tools."id" = numbered_smartlinks."id";

CREATE UNIQUE INDEX "incentive_tools_publisherSubId_key"
ON "incentive_tools"("publisherSubId");
