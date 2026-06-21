-- Daily practice scheduling/progress for offline-first warmup tasks.

CREATE TABLE "user_warmup_item_progress" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "packId" TEXT NOT NULL,
  "topicId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'new',
  "dueDate" DATE NOT NULL,
  "lastPracticedAt" TIMESTAMP(3),
  "bestScore" TEXT,
  "bestScoreRank" INTEGER NOT NULL DEFAULT 0,
  "lastScore" TEXT,
  "lastScoreRank" INTEGER NOT NULL DEFAULT 0,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "correctCount" INTEGER NOT NULL DEFAULT 0,
  "streak" INTEGER NOT NULL DEFAULT 0,
  "lapseCount" INTEGER NOT NULL DEFAULT 0,
  "intervalDays" INTEGER NOT NULL DEFAULT 0,
  "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_warmup_item_progress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_daily_practice_run" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'single',
  "packIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "scheduledItemIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "completedItemIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "stats" JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_daily_practice_run_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_daily_practice_attempt" (
  "id" TEXT NOT NULL,
  "clientAttemptId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "packId" TEXT NOT NULL,
  "topicId" TEXT NOT NULL,
  "runId" TEXT,
  "score" TEXT NOT NULL,
  "scoreRank" INTEGER NOT NULL,
  "passed" BOOLEAN NOT NULL DEFAULT false,
  "payload" JSONB,
  "practicedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_daily_practice_attempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_warmup_item_progress_userId_itemId_key" ON "user_warmup_item_progress"("userId", "itemId");
CREATE INDEX "user_warmup_item_progress_userId_packId_idx" ON "user_warmup_item_progress"("userId", "packId");
CREATE INDEX "user_warmup_item_progress_userId_topicId_idx" ON "user_warmup_item_progress"("userId", "topicId");
CREATE INDEX "user_warmup_item_progress_userId_dueDate_idx" ON "user_warmup_item_progress"("userId", "dueDate");

CREATE UNIQUE INDEX "user_daily_practice_run_userId_date_key" ON "user_daily_practice_run"("userId", "date");
CREATE INDEX "user_daily_practice_run_userId_date_idx" ON "user_daily_practice_run"("userId", "date");

CREATE UNIQUE INDEX "user_daily_practice_attempt_clientAttemptId_key" ON "user_daily_practice_attempt"("clientAttemptId");
CREATE INDEX "user_daily_practice_attempt_userId_itemId_idx" ON "user_daily_practice_attempt"("userId", "itemId");
CREATE INDEX "user_daily_practice_attempt_userId_practicedAt_idx" ON "user_daily_practice_attempt"("userId", "practicedAt");

ALTER TABLE "user_warmup_item_progress" ADD CONSTRAINT "user_warmup_item_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_daily_practice_run" ADD CONSTRAINT "user_daily_practice_run_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_daily_practice_attempt" ADD CONSTRAINT "user_daily_practice_attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
