-- Reuse TrainingTopic for practice, writing, reading and listening. Novel
-- packages keep their EPUB separately because they do not require topics.
ALTER TYPE "FileAssetGroup" ADD VALUE IF NOT EXISTS 'epub';

CREATE TYPE "ContentMode" AS ENUM ('practice', 'writing', 'reading', 'listening', 'novel', 'story');
CREATE TYPE "TopicActivityType" AS ENUM ('practice', 'writing', 'reading', 'listening');
CREATE TYPE "PackageGroupStatus" AS ENUM ('draft', 'published', 'archived');
CREATE TYPE "TopicSubmissionStatus" AS ENUM ('draft', 'submitted', 'reviewed', 'completed');

ALTER TABLE "scene" ADD COLUMN "contentMode" "ContentMode" NOT NULL DEFAULT 'practice';
UPDATE "scene" SET "contentMode" = 'story' WHERE "packageType" = 'story';

ALTER TABLE "training_topic"
  ADD COLUMN "activityType" "TopicActivityType" NOT NULL DEFAULT 'practice',
  ADD COLUMN "contentConfig" JSONB,
  ADD COLUMN "mediaAssetId" TEXT,
  ADD COLUMN "transcript" JSONB;

CREATE TABLE "package_group" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "coverImage" TEXT,
    "contentMode" "ContentMode",
    "status" "PackageGroupStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "package_group_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "package_group_item" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "volumeLabel" TEXT,
    "requiredPrevious" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "package_group_item_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "scene_vocabulary" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "vocabularyId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "scene_vocabulary_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "scene_chunk" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "scene_chunk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "scene_sentence_pattern" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "patternId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "scene_sentence_pattern_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "training_topic_submission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "status" "TopicSubmissionStatus" NOT NULL DEFAULT 'draft',
    "response" JSONB NOT NULL,
    "feedback" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "training_topic_submission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "novel_package" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "epubAssetId" TEXT NOT NULL,
    "metadata" JSONB,
    "toc" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "novel_package_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "novel_reading_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "novelPackageId" TEXT NOT NULL,
    "locator" JSONB NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "novel_reading_progress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "package_group_slug_key" ON "package_group"("slug");
CREATE INDEX "package_group_status_createdAt_idx" ON "package_group"("status", "createdAt");
CREATE UNIQUE INDEX "package_group_item_sceneId_key" ON "package_group_item"("sceneId");
CREATE UNIQUE INDEX "package_group_item_groupId_sortOrder_key" ON "package_group_item"("groupId", "sortOrder");
CREATE INDEX "package_group_item_groupId_sortOrder_idx" ON "package_group_item"("groupId", "sortOrder");
CREATE UNIQUE INDEX "scene_vocabulary_sceneId_vocabularyId_key" ON "scene_vocabulary"("sceneId", "vocabularyId");
CREATE INDEX "scene_vocabulary_sceneId_sortOrder_idx" ON "scene_vocabulary"("sceneId", "sortOrder");
CREATE UNIQUE INDEX "scene_chunk_sceneId_chunkId_key" ON "scene_chunk"("sceneId", "chunkId");
CREATE INDEX "scene_chunk_sceneId_sortOrder_idx" ON "scene_chunk"("sceneId", "sortOrder");
CREATE UNIQUE INDEX "scene_sentence_pattern_sceneId_patternId_key" ON "scene_sentence_pattern"("sceneId", "patternId");
CREATE INDEX "scene_sentence_pattern_sceneId_sortOrder_idx" ON "scene_sentence_pattern"("sceneId", "sortOrder");
CREATE UNIQUE INDEX "training_topic_submission_userId_topicId_revision_key" ON "training_topic_submission"("userId", "topicId", "revision");
CREATE INDEX "training_topic_submission_userId_updatedAt_idx" ON "training_topic_submission"("userId", "updatedAt");
CREATE UNIQUE INDEX "novel_package_sceneId_key" ON "novel_package"("sceneId");
CREATE UNIQUE INDEX "novel_reading_progress_userId_novelPackageId_key" ON "novel_reading_progress"("userId", "novelPackageId");
CREATE INDEX "novel_reading_progress_userId_updatedAt_idx" ON "novel_reading_progress"("userId", "updatedAt");

ALTER TABLE "training_topic" ADD CONSTRAINT "training_topic_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "file_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "package_group_item" ADD CONSTRAINT "package_group_item_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "package_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "package_group_item" ADD CONSTRAINT "package_group_item_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scene_vocabulary" ADD CONSTRAINT "scene_vocabulary_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scene_vocabulary" ADD CONSTRAINT "scene_vocabulary_vocabularyId_fkey" FOREIGN KEY ("vocabularyId") REFERENCES "vocabulary"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scene_chunk" ADD CONSTRAINT "scene_chunk_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scene_chunk" ADD CONSTRAINT "scene_chunk_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "chunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scene_sentence_pattern" ADD CONSTRAINT "scene_sentence_pattern_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scene_sentence_pattern" ADD CONSTRAINT "scene_sentence_pattern_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "sentence_pattern"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_topic_submission" ADD CONSTRAINT "training_topic_submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_topic_submission" ADD CONSTRAINT "training_topic_submission_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "training_topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "novel_package" ADD CONSTRAINT "novel_package_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "novel_package" ADD CONSTRAINT "novel_package_epubAssetId_fkey" FOREIGN KEY ("epubAssetId") REFERENCES "file_asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "novel_reading_progress" ADD CONSTRAINT "novel_reading_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "novel_reading_progress" ADD CONSTRAINT "novel_reading_progress_novelPackageId_fkey" FOREIGN KEY ("novelPackageId") REFERENCES "novel_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;
