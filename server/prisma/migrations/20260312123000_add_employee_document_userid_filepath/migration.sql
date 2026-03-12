-- AlterTable
ALTER TABLE "EmployeeDocument"
  ADD COLUMN IF NOT EXISTS "userId" TEXT,
  ADD COLUMN IF NOT EXISTS "filePath" TEXT;

-- Backfill from legacy placeholders storage metadata when available
UPDATE "EmployeeDocument"
SET
  "userId" = COALESCE("userId", NULLIF("placeholders" -> '__storage' ->> 'userId', '')),
  "filePath" = COALESCE("filePath", NULLIF("placeholders" -> '__storage' ->> 'filePath', ''))
WHERE "placeholders" IS NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmployeeDocument_companyId_userId_idx"
ON "EmployeeDocument"("companyId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmployeeDocument_companyId_userId_type_year_month_idx"
ON "EmployeeDocument"("companyId", "userId", "type", "year", "month");
