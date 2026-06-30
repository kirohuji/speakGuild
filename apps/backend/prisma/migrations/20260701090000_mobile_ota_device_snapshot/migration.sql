ALTER TABLE "mobile_ota_tester" ADD COLUMN IF NOT EXISTS "lastPlatform" TEXT;
ALTER TABLE "mobile_ota_tester" ADD COLUMN IF NOT EXISTS "lastDeviceModel" TEXT;
ALTER TABLE "mobile_ota_tester" ADD COLUMN IF NOT EXISTS "lastDeviceName" TEXT;
ALTER TABLE "mobile_ota_tester" ADD COLUMN IF NOT EXISTS "lastManufacturer" TEXT;
ALTER TABLE "mobile_ota_tester" ADD COLUMN IF NOT EXISTS "lastOperatingSystem" TEXT;
ALTER TABLE "mobile_ota_tester" ADD COLUMN IF NOT EXISTS "lastOsVersion" TEXT;
ALTER TABLE "mobile_ota_tester" ADD COLUMN IF NOT EXISTS "lastNativeBuild" TEXT;
