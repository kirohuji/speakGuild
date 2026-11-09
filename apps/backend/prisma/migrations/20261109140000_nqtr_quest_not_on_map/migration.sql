ALTER TABLE "game_quest" DROP CONSTRAINT IF EXISTS "game_quest_mapId_fkey";
DROP INDEX IF EXISTS "game_quest_mapId_idx";
ALTER TABLE "game_quest" DROP COLUMN IF EXISTS "mapId";
