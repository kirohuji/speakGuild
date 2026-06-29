-- Drop audience column and its index from mobile_bundle
-- audience was replaced by channel-based audience control:
--   channel='production' → all users
--   channel='staging'    → testers only (via mobile_ota_tester table)

DROP INDEX IF EXISTS "mobile_bundle_platform_channel_audience_enabled_idx";

ALTER TABLE "mobile_bundle" DROP COLUMN IF EXISTS "audience";
