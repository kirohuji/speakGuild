ALTER TABLE "game_room" ADD COLUMN IF NOT EXISTS "activities" JSONB;
ALTER TABLE "game_save" ADD COLUMN IF NOT EXISTS "gameDay" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "game_save" ADD COLUMN IF NOT EXISTS "gameMinutes" INTEGER NOT NULL DEFAULT 480;
ALTER TABLE "game_save" ADD COLUMN IF NOT EXISTS "questProgress" JSONB;

CREATE TABLE IF NOT EXISTS "game_quest" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "mapId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "game_quest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "game_quest_stage" (
  "id" TEXT NOT NULL,
  "questId" TEXT NOT NULL,
  "stageKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "inkScriptId" TEXT,
  "requiredFlags" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "game_quest_stage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "game_quest_key_key" ON "game_quest"("key");
CREATE INDEX IF NOT EXISTS "game_quest_mapId_idx" ON "game_quest"("mapId");
CREATE UNIQUE INDEX IF NOT EXISTS "game_quest_stage_questId_stageKey_key" ON "game_quest_stage"("questId", "stageKey");
CREATE INDEX IF NOT EXISTS "game_quest_stage_questId_sortOrder_idx" ON "game_quest_stage"("questId", "sortOrder");

ALTER TABLE "game_quest" DROP CONSTRAINT IF EXISTS "game_quest_mapId_fkey";
ALTER TABLE "game_quest"
  ADD CONSTRAINT "game_quest_mapId_fkey"
  FOREIGN KEY ("mapId") REFERENCES "game_map"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "game_quest_stage" DROP CONSTRAINT IF EXISTS "game_quest_stage_questId_fkey";
ALTER TABLE "game_quest_stage"
  ADD CONSTRAINT "game_quest_stage_questId_fkey"
  FOREIGN KEY ("questId") REFERENCES "game_quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
