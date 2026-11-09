ALTER TABLE "game_room" DROP COLUMN IF EXISTS "activities";
ALTER TABLE "game_quest_stage" DROP COLUMN IF EXISTS "inkScriptId";
ALTER TABLE "game_quest_stage" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "game_quest_stage" ADD COLUMN IF NOT EXISTS "deltaDays" INTEGER;
ALTER TABLE "game_quest_stage" ADD COLUMN IF NOT EXISTS "startNote" TEXT;

CREATE TABLE IF NOT EXISTS "game_activity" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "minutes" INTEGER NOT NULL DEFAULT 0,
  "startMinute" INTEGER,
  "endMinute" INTEGER,
  "trigger" TEXT NOT NULL DEFAULT 'click',
  "inkScriptId" TEXT,
  "hiddenFlag" TEXT,
  "disabledFlag" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "game_activity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "game_room_activity" (
  "roomId" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  CONSTRAINT "game_room_activity_pkey" PRIMARY KEY ("roomId", "activityId")
);

CREATE TABLE IF NOT EXISTS "game_commitment" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "startMinute" INTEGER NOT NULL,
  "endMinute" INTEGER NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "trigger" TEXT NOT NULL DEFAULT 'click',
  "inkScriptId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "game_commitment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "game_quest_stage_action" (
  "id" TEXT NOT NULL,
  "stageId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "kind" TEXT NOT NULL,
  "activityId" TEXT,
  "commitmentId" TEXT,
  "roomId" TEXT,
  CONSTRAINT "game_quest_stage_action_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "game_activity_key_key" ON "game_activity"("key");
CREATE INDEX IF NOT EXISTS "game_room_activity_activityId_idx" ON "game_room_activity"("activityId");
CREATE UNIQUE INDEX IF NOT EXISTS "game_commitment_key_key" ON "game_commitment"("key");
CREATE INDEX IF NOT EXISTS "game_commitment_roomId_idx" ON "game_commitment"("roomId");
CREATE INDEX IF NOT EXISTS "game_commitment_characterId_idx" ON "game_commitment"("characterId");
CREATE INDEX IF NOT EXISTS "game_quest_stage_action_stageId_sortOrder_idx" ON "game_quest_stage_action"("stageId", "sortOrder");

ALTER TABLE "game_room_activity" DROP CONSTRAINT IF EXISTS "game_room_activity_roomId_fkey";
ALTER TABLE "game_room_activity" ADD CONSTRAINT "game_room_activity_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "game_room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "game_room_activity" DROP CONSTRAINT IF EXISTS "game_room_activity_activityId_fkey";
ALTER TABLE "game_room_activity" ADD CONSTRAINT "game_room_activity_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "game_activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "game_commitment" DROP CONSTRAINT IF EXISTS "game_commitment_characterId_fkey";
ALTER TABLE "game_commitment" ADD CONSTRAINT "game_commitment_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "game_character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "game_commitment" DROP CONSTRAINT IF EXISTS "game_commitment_roomId_fkey";
ALTER TABLE "game_commitment" ADD CONSTRAINT "game_commitment_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "game_room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "game_quest_stage_action" DROP CONSTRAINT IF EXISTS "game_quest_stage_action_stageId_fkey";
ALTER TABLE "game_quest_stage_action" ADD CONSTRAINT "game_quest_stage_action_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "game_quest_stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "game_quest_stage_action" DROP CONSTRAINT IF EXISTS "game_quest_stage_action_activityId_fkey";
ALTER TABLE "game_quest_stage_action" ADD CONSTRAINT "game_quest_stage_action_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "game_activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "game_quest_stage_action" DROP CONSTRAINT IF EXISTS "game_quest_stage_action_commitmentId_fkey";
ALTER TABLE "game_quest_stage_action" ADD CONSTRAINT "game_quest_stage_action_commitmentId_fkey" FOREIGN KEY ("commitmentId") REFERENCES "game_commitment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "game_quest_stage_action" DROP CONSTRAINT IF EXISTS "game_quest_stage_action_roomId_fkey";
ALTER TABLE "game_quest_stage_action" ADD CONSTRAINT "game_quest_stage_action_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "game_room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
