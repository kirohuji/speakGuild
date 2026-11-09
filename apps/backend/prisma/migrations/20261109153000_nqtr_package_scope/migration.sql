ALTER TYPE "LearningPackageType" ADD VALUE IF NOT EXISTS 'nqtr';
ALTER TYPE "ContentMode" ADD VALUE IF NOT EXISTS 'nqtr';

ALTER TABLE "scene" ADD COLUMN IF NOT EXISTS "nqtrMapId" TEXT;
ALTER TABLE "scene" DROP CONSTRAINT IF EXISTS "scene_nqtrMapId_fkey";
ALTER TABLE "scene" ADD CONSTRAINT "scene_nqtrMapId_fkey" FOREIGN KEY ("nqtrMapId") REFERENCES "game_map"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "scene_nqtr_character" (
  "sceneId" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  CONSTRAINT "scene_nqtr_character_pkey" PRIMARY KEY ("sceneId", "characterId")
);
CREATE INDEX IF NOT EXISTS "scene_nqtr_character_characterId_idx" ON "scene_nqtr_character"("characterId");
ALTER TABLE "scene_nqtr_character" DROP CONSTRAINT IF EXISTS "scene_nqtr_character_sceneId_fkey";
ALTER TABLE "scene_nqtr_character" ADD CONSTRAINT "scene_nqtr_character_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scene_nqtr_character" DROP CONSTRAINT IF EXISTS "scene_nqtr_character_characterId_fkey";
ALTER TABLE "scene_nqtr_character" ADD CONSTRAINT "scene_nqtr_character_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "game_character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "game_activity" ADD COLUMN IF NOT EXISTS "sceneId" TEXT;
ALTER TABLE "game_commitment" ADD COLUMN IF NOT EXISTS "sceneId" TEXT;
ALTER TABLE "game_quest" ADD COLUMN IF NOT EXISTS "sceneId" TEXT;
DELETE FROM "game_activity" WHERE "sceneId" IS NULL;
DELETE FROM "game_commitment" WHERE "sceneId" IS NULL;
DELETE FROM "game_quest" WHERE "sceneId" IS NULL;
ALTER TABLE "game_activity" ALTER COLUMN "sceneId" SET NOT NULL;
ALTER TABLE "game_commitment" ALTER COLUMN "sceneId" SET NOT NULL;
ALTER TABLE "game_quest" ALTER COLUMN "sceneId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "game_activity_sceneId_idx" ON "game_activity"("sceneId");
CREATE INDEX IF NOT EXISTS "game_commitment_sceneId_idx" ON "game_commitment"("sceneId");
CREATE INDEX IF NOT EXISTS "game_quest_sceneId_idx" ON "game_quest"("sceneId");

ALTER TABLE "game_activity" DROP CONSTRAINT IF EXISTS "game_activity_sceneId_fkey";
ALTER TABLE "game_activity" ADD CONSTRAINT "game_activity_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "game_commitment" DROP CONSTRAINT IF EXISTS "game_commitment_sceneId_fkey";
ALTER TABLE "game_commitment" ADD CONSTRAINT "game_commitment_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "game_quest" DROP CONSTRAINT IF EXISTS "game_quest_sceneId_fkey";
ALTER TABLE "game_quest" ADD CONSTRAINT "game_quest_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;
