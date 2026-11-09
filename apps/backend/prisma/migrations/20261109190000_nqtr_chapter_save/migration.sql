CREATE TABLE IF NOT EXISTS "nqtr_chapter" (
  "id" TEXT NOT NULL,
  "sceneId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "nqtr_chapter_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "nqtr_chapter_sceneId_sortOrder_idx" ON "nqtr_chapter"("sceneId", "sortOrder");
ALTER TABLE "nqtr_chapter" DROP CONSTRAINT IF EXISTS "nqtr_chapter_sceneId_fkey";
ALTER TABLE "nqtr_chapter" ADD CONSTRAINT "nqtr_chapter_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "nqtr_chapter_character" (
  "chapterId" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  CONSTRAINT "nqtr_chapter_character_pkey" PRIMARY KEY ("chapterId", "characterId")
);
CREATE INDEX IF NOT EXISTS "nqtr_chapter_character_characterId_idx" ON "nqtr_chapter_character"("characterId");
ALTER TABLE "nqtr_chapter_character" DROP CONSTRAINT IF EXISTS "nqtr_chapter_character_chapterId_fkey";
ALTER TABLE "nqtr_chapter_character" ADD CONSTRAINT "nqtr_chapter_character_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "nqtr_chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nqtr_chapter_character" DROP CONSTRAINT IF EXISTS "nqtr_chapter_character_characterId_fkey";
ALTER TABLE "nqtr_chapter_character" ADD CONSTRAINT "nqtr_chapter_character_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "game_character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "nqtr_chapter_location" (
  "chapterId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  CONSTRAINT "nqtr_chapter_location_pkey" PRIMARY KEY ("chapterId", "locationId")
);
CREATE INDEX IF NOT EXISTS "nqtr_chapter_location_locationId_idx" ON "nqtr_chapter_location"("locationId");
ALTER TABLE "nqtr_chapter_location" DROP CONSTRAINT IF EXISTS "nqtr_chapter_location_chapterId_fkey";
ALTER TABLE "nqtr_chapter_location" ADD CONSTRAINT "nqtr_chapter_location_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "nqtr_chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nqtr_chapter_location" DROP CONSTRAINT IF EXISTS "nqtr_chapter_location_locationId_fkey";
ALTER TABLE "nqtr_chapter_location" ADD CONSTRAINT "nqtr_chapter_location_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "game_location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "game_activity" ADD COLUMN IF NOT EXISTS "chapterId" TEXT;
ALTER TABLE "game_commitment" ADD COLUMN IF NOT EXISTS "chapterId" TEXT;
ALTER TABLE "game_quest" ADD COLUMN IF NOT EXISTS "chapterId" TEXT;
CREATE INDEX IF NOT EXISTS "game_activity_chapterId_idx" ON "game_activity"("chapterId");
CREATE INDEX IF NOT EXISTS "game_commitment_chapterId_idx" ON "game_commitment"("chapterId");
CREATE INDEX IF NOT EXISTS "game_quest_chapterId_idx" ON "game_quest"("chapterId");

INSERT INTO "nqtr_chapter" ("id", "sceneId", "sortOrder", "title", "updatedAt")
SELECT 'nqtrch_' || s."id", s."id", 0, '第一章', CURRENT_TIMESTAMP
FROM "scene" s
WHERE s."contentMode" = 'nqtr'
  AND NOT EXISTS (SELECT 1 FROM "nqtr_chapter" c WHERE c."sceneId" = s."id");

UPDATE "game_activity" a
SET "chapterId" = 'nqtrch_' || a."sceneId"
WHERE a."chapterId" IS NULL
  AND EXISTS (SELECT 1 FROM "nqtr_chapter" c WHERE c."id" = 'nqtrch_' || a."sceneId");
UPDATE "game_commitment" a
SET "chapterId" = 'nqtrch_' || a."sceneId"
WHERE a."chapterId" IS NULL
  AND EXISTS (SELECT 1 FROM "nqtr_chapter" c WHERE c."id" = 'nqtrch_' || a."sceneId");
UPDATE "game_quest" a
SET "chapterId" = 'nqtrch_' || a."sceneId"
WHERE a."chapterId" IS NULL
  AND EXISTS (SELECT 1 FROM "nqtr_chapter" c WHERE c."id" = 'nqtrch_' || a."sceneId");

ALTER TABLE "game_activity" DROP CONSTRAINT IF EXISTS "game_activity_chapterId_fkey";
ALTER TABLE "game_activity" ADD CONSTRAINT "game_activity_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "nqtr_chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "game_commitment" DROP CONSTRAINT IF EXISTS "game_commitment_chapterId_fkey";
ALTER TABLE "game_commitment" ADD CONSTRAINT "game_commitment_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "nqtr_chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "game_quest" DROP CONSTRAINT IF EXISTS "game_quest_chapterId_fkey";
ALTER TABLE "game_quest" ADD CONSTRAINT "game_quest_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "nqtr_chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "game_save" ADD COLUMN IF NOT EXISTS "sceneId" TEXT;
ALTER TABLE "game_save" ADD COLUMN IF NOT EXISTS "chapterId" TEXT;
ALTER TABLE "game_save" ADD COLUMN IF NOT EXISTS "runtime" JSONB;
ALTER TABLE "game_save" DROP CONSTRAINT IF EXISTS "game_save_userId_slot_key";
CREATE UNIQUE INDEX IF NOT EXISTS "game_save_userId_sceneId_slot_key" ON "game_save"("userId", "sceneId", "slot");
ALTER TABLE "game_save" DROP CONSTRAINT IF EXISTS "game_save_sceneId_fkey";
ALTER TABLE "game_save" ADD CONSTRAINT "game_save_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "game_save" DROP CONSTRAINT IF EXISTS "game_save_chapterId_fkey";
ALTER TABLE "game_save" ADD CONSTRAINT "game_save_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "nqtr_chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
