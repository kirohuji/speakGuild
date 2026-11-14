ALTER TYPE "FileAssetGroup" ADD VALUE IF NOT EXISTS 'offline_model';
CREATE TABLE "offline_model_version" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "variantId" TEXT NOT NULL, "version" TEXT NOT NULL, "modelId" TEXT NOT NULL,
  "purpose" TEXT NOT NULL, "dtype" TEXT NOT NULL, "sourceRevision" TEXT NOT NULL DEFAULT 'main',
  "sourceCommit" TEXT, "status" TEXT NOT NULL DEFAULT 'queued', "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "publishedAt" TIMESTAMP(3), "files" JSONB NOT NULL DEFAULT '[]', "totalBytes" INTEGER NOT NULL DEFAULT 0,
  "bundleAssetId" TEXT, "importAssetId" TEXT, "taskId" TEXT, "deviceValidation" TEXT NOT NULL DEFAULT 'unverified',
  "validationNote" TEXT, "errorMessage" TEXT, "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "offline_model_version_variantId_version_key" ON "offline_model_version"("variantId", "version");
CREATE INDEX "offline_model_version_variantId_isPublished_idx" ON "offline_model_version"("variantId", "isPublished");
CREATE UNIQUE INDEX "offline_model_one_published_variant" ON "offline_model_version"("variantId") WHERE "isPublished" = true;
