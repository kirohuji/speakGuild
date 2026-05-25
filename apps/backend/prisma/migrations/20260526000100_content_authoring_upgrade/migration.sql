-- Add richer authoring metadata for English content management.
ALTER TABLE "chunk" ADD COLUMN "description" TEXT;

ALTER TABLE "scene_vocabulary" ADD COLUMN "description" TEXT;

ALTER TABLE "training_topic" ADD COLUMN "description" TEXT;
ALTER TABLE "training_topic" ADD COLUMN "sentencePatterns" JSONB;

ALTER TABLE "script_episode" ADD COLUMN "description" TEXT;

CREATE TABLE "chunk_example" (
    "id" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "en" TEXT NOT NULL,
    "zh" TEXT NOT NULL,
    "note" TEXT,
    "level" TEXT NOT NULL DEFAULT 'basic',
    "sceneId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chunk_example_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "chunk_example_chunkId_sortOrder_idx" ON "chunk_example"("chunkId", "sortOrder");
CREATE INDEX "chunk_example_sceneId_idx" ON "chunk_example"("sceneId");

ALTER TABLE "chunk_example" ADD CONSTRAINT "chunk_example_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "chunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chunk_example" ADD CONSTRAINT "chunk_example_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scene"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "chunk_example" ("id", "chunkId", "en", "zh", "level", "sortOrder", "createdAt")
SELECT
  'cm_' || substr(md5(random()::text || clock_timestamp()::text || "id"), 1, 24),
  "id",
  "example",
  '',
  'basic',
  0,
  CURRENT_TIMESTAMP
FROM "chunk"
WHERE "example" IS NOT NULL AND length(trim("example")) > 0;
