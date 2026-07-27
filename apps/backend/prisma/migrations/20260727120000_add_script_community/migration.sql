CREATE TYPE "ScriptPracticeMode" AS ENUM ('vn', 'repeat');
CREATE TYPE "ScriptPracticeStatus" AS ENUM ('active', 'completed', 'abandoned');
CREATE TYPE "ScriptWorkStatus" AS ENUM ('draft', 'rendering', 'ready', 'published', 'failed', 'hidden');
CREATE TYPE "ScriptWorkKind" AS ENUM ('vn_video', 'repeat_video', 'progress_card');

CREATE TABLE "script_practice_record" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "mode" "ScriptPracticeMode" NOT NULL,
    "status" "ScriptPracticeStatus" NOT NULL DEFAULT 'active',
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "turnCount" INTEGER NOT NULL DEFAULT 0,
    "lineCount" INTEGER NOT NULL DEFAULT 0,
    "usedChunkCount" INTEGER NOT NULL DEFAULT 0,
    "completedObjectiveCount" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER,
    "resultSnapshot" JSONB,
    "audioAssetId" TEXT,
    "videoAssetId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "script_practice_record_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "script_work" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "recordId" TEXT,
    "kind" "ScriptWorkKind" NOT NULL,
    "status" "ScriptWorkStatus" NOT NULL DEFAULT 'draft',
    "title" TEXT NOT NULL,
    "caption" TEXT,
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "renderPayload" JSONB,
    "renderError" TEXT,
    "videoAssetId" TEXT,
    "coverAssetId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "hiddenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "script_work_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "script_work_like" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "script_work_like_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "script_work_reaction" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reaction" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "script_work_reaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "script_work_report" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "script_work_report_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "script_practice_record_userId_createdAt_idx" ON "script_practice_record"("userId", "createdAt" DESC);
CREATE INDEX "script_practice_record_userId_mode_createdAt_idx" ON "script_practice_record"("userId", "mode", "createdAt" DESC);
CREATE INDEX "script_practice_record_episodeId_status_idx" ON "script_practice_record"("episodeId", "status");
CREATE INDEX "script_work_userId_createdAt_idx" ON "script_work"("userId", "createdAt" DESC);
CREATE INDEX "script_work_status_publishedAt_idx" ON "script_work"("status", "publishedAt" DESC);
CREATE INDEX "script_work_episodeId_status_idx" ON "script_work"("episodeId", "status");
CREATE UNIQUE INDEX "script_work_like_workId_userId_key" ON "script_work_like"("workId", "userId");
CREATE INDEX "script_work_like_userId_createdAt_idx" ON "script_work_like"("userId", "createdAt" DESC);
CREATE UNIQUE INDEX "script_work_reaction_workId_userId_key" ON "script_work_reaction"("workId", "userId");
CREATE INDEX "script_work_reaction_workId_reaction_idx" ON "script_work_reaction"("workId", "reaction");
CREATE UNIQUE INDEX "script_work_report_workId_userId_key" ON "script_work_report"("workId", "userId");
CREATE INDEX "script_work_report_createdAt_idx" ON "script_work_report"("createdAt" DESC);

ALTER TABLE "script_practice_record" ADD CONSTRAINT "script_practice_record_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "script_practice_record" ADD CONSTRAINT "script_practice_record_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "script_episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "script_practice_record" ADD CONSTRAINT "script_practice_record_audioAssetId_fkey" FOREIGN KEY ("audioAssetId") REFERENCES "file_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "script_practice_record" ADD CONSTRAINT "script_practice_record_videoAssetId_fkey" FOREIGN KEY ("videoAssetId") REFERENCES "file_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "script_work" ADD CONSTRAINT "script_work_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "script_work" ADD CONSTRAINT "script_work_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "script_episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "script_work" ADD CONSTRAINT "script_work_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "script_practice_record"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "script_work" ADD CONSTRAINT "script_work_videoAssetId_fkey" FOREIGN KEY ("videoAssetId") REFERENCES "file_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "script_work" ADD CONSTRAINT "script_work_coverAssetId_fkey" FOREIGN KEY ("coverAssetId") REFERENCES "file_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "script_work_like" ADD CONSTRAINT "script_work_like_workId_fkey" FOREIGN KEY ("workId") REFERENCES "script_work"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "script_work_like" ADD CONSTRAINT "script_work_like_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "script_work_reaction" ADD CONSTRAINT "script_work_reaction_workId_fkey" FOREIGN KEY ("workId") REFERENCES "script_work"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "script_work_reaction" ADD CONSTRAINT "script_work_reaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "script_work_report" ADD CONSTRAINT "script_work_report_workId_fkey" FOREIGN KEY ("workId") REFERENCES "script_work"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "script_work_report" ADD CONSTRAINT "script_work_report_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
