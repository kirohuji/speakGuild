-- The application has not been released, so the old warmup streak is removed
-- instead of being interpreted as an SM-2 repetition count.
ALTER TABLE "user_warmup_item_progress"
DROP COLUMN "streak",
ADD COLUMN "reviewCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "learning_notebook_item"
ADD COLUMN "intervalDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lapseCount" INTEGER NOT NULL DEFAULT 0;
