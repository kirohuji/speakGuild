-- Add version tracking fields to mobile_ota_tester
ALTER TABLE "mobile_ota_tester" ADD COLUMN IF NOT EXISTS "lastBundleVersion" TEXT;
ALTER TABLE "mobile_ota_tester" ADD COLUMN IF NOT EXISTS "lastNativeVersion" TEXT;
ALTER TABLE "mobile_ota_tester" ADD COLUMN IF NOT EXISTS "lastCheckAt" TIMESTAMPTZ;
