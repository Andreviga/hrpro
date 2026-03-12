-- AlterTable: add snapshot and reopen audit fields to PayrollRun
ALTER TABLE "PayrollRun"
  ADD COLUMN IF NOT EXISTS "closedSnapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "reopenedAt"     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "reopenedBy"     TEXT,
  ADD COLUMN IF NOT EXISTS "reopenReason"   TEXT;
