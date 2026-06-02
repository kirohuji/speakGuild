-- CreateTable
CREATE TABLE "mobile_bundle" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'production',
    "assetId" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "minNativeVersion" TEXT,
    "rolloutPercent" INTEGER NOT NULL DEFAULT 100,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "releaseNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mobile_bundle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mobile_bundle_version_platform_channel_key" ON "mobile_bundle"("version", "platform", "channel");

-- CreateIndex
CREATE INDEX "mobile_bundle_platform_channel_enabled_idx" ON "mobile_bundle"("platform", "channel", "enabled");

-- CreateIndex
CREATE INDEX "mobile_bundle_assetId_idx" ON "mobile_bundle"("assetId");

-- AddForeignKey
ALTER TABLE "mobile_bundle" ADD CONSTRAINT "mobile_bundle_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "file_asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
