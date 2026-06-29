-- OTA bundle release lanes and per-user tester targeting.
ALTER TABLE "mobile_bundle"
  ADD COLUMN "releaseLine" TEXT,
  ADD COLUMN "audience" TEXT NOT NULL DEFAULT 'all',
  ADD COLUMN "notifyPolicy" TEXT NOT NULL DEFAULT 'auto',
  ADD COLUMN "allowMajorUpgrade" BOOLEAN NOT NULL DEFAULT false;

UPDATE "mobile_bundle"
SET "releaseLine" = split_part("version", '.', 1) || '.' || split_part("version", '.', 2)
WHERE "version" ~ '^[0-9]+\.[0-9]+(\.[0-9]+)?$';

CREATE INDEX "mobile_bundle_platform_channel_audience_enabled_idx"
  ON "mobile_bundle"("platform", "channel", "audience", "enabled");
CREATE INDEX "mobile_bundle_releaseLine_idx"
  ON "mobile_bundle"("releaseLine");

CREATE TABLE "mobile_ota_tester" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "channel" TEXT NOT NULL DEFAULT 'production',
  "platform" TEXT,
  "targetReleaseLine" TEXT,
  "targetVersion" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "mobile_ota_tester_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mobile_ota_tester_userId_key" ON "mobile_ota_tester"("userId");
CREATE INDEX "mobile_ota_tester_enabled_channel_idx" ON "mobile_ota_tester"("enabled", "channel");
CREATE INDEX "mobile_ota_tester_targetReleaseLine_idx" ON "mobile_ota_tester"("targetReleaseLine");

ALTER TABLE "mobile_ota_tester"
  ADD CONSTRAINT "mobile_ota_tester_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
