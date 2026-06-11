ALTER TYPE "FileAssetGroup" ADD VALUE IF NOT EXISTS 'learning_pack';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LearningPackageStatus') THEN
    CREATE TYPE "LearningPackageStatus" AS ENUM ('draft', 'building', 'published', 'failed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "learning_package" (
  "id" TEXT NOT NULL,
  "sceneId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "status" "LearningPackageStatus" NOT NULL DEFAULT 'draft',
  "fileAssetId" TEXT,
  "zipChecksum" TEXT,
  "zipSize" INTEGER,
  "manifestSnapshot" JSONB,
  "buildLog" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "learning_package_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "learning_package_sceneId_version_key" ON "learning_package"("sceneId", "version");
CREATE INDEX IF NOT EXISTS "learning_package_sceneId_status_version_idx" ON "learning_package"("sceneId", "status", "version");

ALTER TABLE "learning_package"
  ADD CONSTRAINT "learning_package_sceneId_fkey"
  FOREIGN KEY ("sceneId") REFERENCES "scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "learning_package"
  ADD CONSTRAINT "learning_package_fileAssetId_fkey"
  FOREIGN KEY ("fileAssetId") REFERENCES "file_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
