-- CreateTable
CREATE TABLE "practice_session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "inkScriptId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "topicSnapshot" JSONB NOT NULL,
    "sceneSnapshot" JSONB NOT NULL,
    "objectivesSnapshot" JSONB NOT NULL,
    "chunksSnapshot" JSONB NOT NULL,
    "vocabSnapshot" JSONB NOT NULL,
    "sentencePatternsSnapshot" JSONB,
    "turnCount" INTEGER NOT NULL DEFAULT 0,
    "analysisResult" JSONB,
    "analysisRaw" TEXT,
    "analysisError" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "analyzedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practice_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_turn" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "npcText" TEXT NOT NULL,
    "userText" TEXT NOT NULL,
    "userAudioUrl" TEXT,
    "inputNodeId" TEXT,
    "tags" JSONB,
    "judgement" JSONB,
    "objectivesCompleted" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "chunksUsed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "practice_turn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "practice_session_userId_startedAt_idx" ON "practice_session"("userId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "practice_session_topicId_startedAt_idx" ON "practice_session"("topicId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "practice_session_status_idx" ON "practice_session"("status");

-- CreateIndex
CREATE INDEX "practice_turn_sessionId_round_idx" ON "practice_turn"("sessionId", "round");

-- AddForeignKey
ALTER TABLE "practice_session" ADD CONSTRAINT "practice_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_session" ADD CONSTRAINT "practice_session_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "training_topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_turn" ADD CONSTRAINT "practice_turn_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "practice_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
