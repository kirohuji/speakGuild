ALTER TABLE "game_save" ADD COLUMN IF NOT EXISTS "gameTime" DOUBLE PRECISION NOT NULL DEFAULT 8;

ALTER TABLE "game_activity" ADD COLUMN IF NOT EXISTS "iconUrl" TEXT;
ALTER TABLE "game_activity" ADD COLUMN IF NOT EXISTS "availableFromDate" INTEGER;
ALTER TABLE "game_activity" ADD COLUMN IF NOT EXISTS "availableUntilDate" INTEGER;
ALTER TABLE "game_activity" ADD COLUMN IF NOT EXISTS "timeFrom" DOUBLE PRECISION;
ALTER TABLE "game_activity" ADD COLUMN IF NOT EXISTS "timeTo" DOUBLE PRECISION;
ALTER TABLE "game_activity" ADD COLUMN IF NOT EXISTS "questId" TEXT;
ALTER TABLE "game_activity" ADD COLUMN IF NOT EXISTS "questAction" TEXT;

ALTER TABLE "game_commitment" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "game_commitment" ADD COLUMN IF NOT EXISTS "slotImages" JSONB;
ALTER TABLE "game_commitment" ADD COLUMN IF NOT EXISTS "timeFrom" DOUBLE PRECISION;
ALTER TABLE "game_commitment" ADD COLUMN IF NOT EXISTS "timeTo" DOUBLE PRECISION;
ALTER TABLE "game_commitment" ADD COLUMN IF NOT EXISTS "questId" TEXT;
ALTER TABLE "game_commitment" ADD COLUMN IF NOT EXISTS "questAction" TEXT;

ALTER TABLE "game_quest" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "game_quest_stage_action" ADD COLUMN IF NOT EXISTS "phase" TEXT NOT NULL DEFAULT 'on_start';

CREATE INDEX IF NOT EXISTS "game_activity_questId_idx" ON "game_activity"("questId");
CREATE INDEX IF NOT EXISTS "game_commitment_questId_idx" ON "game_commitment"("questId");

ALTER TABLE "game_activity" DROP CONSTRAINT IF EXISTS "game_activity_questId_fkey";
ALTER TABLE "game_activity" ADD CONSTRAINT "game_activity_questId_fkey" FOREIGN KEY ("questId") REFERENCES "game_quest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "game_commitment" DROP CONSTRAINT IF EXISTS "game_commitment_questId_fkey";
ALTER TABLE "game_commitment" ADD CONSTRAINT "game_commitment_questId_fkey" FOREIGN KEY ("questId") REFERENCES "game_quest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
