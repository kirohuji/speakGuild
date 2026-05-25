-- CreateEnum
CREATE TYPE "ChunkMasteryStatus" AS ENUM ('not_learned', 'activated', 'can_read', 'can_output', 'mastered');

-- CreateEnum
CREATE TYPE "ExpressionType" AS ENUM ('chunk', 'error_sentence', 'upgraded', 'scene_phrase', 'custom');

-- CreateEnum
CREATE TYPE "AchievementCategory" AS ENUM ('milestone', 'streak', 'challenge', 'mastery', 'hidden', 'first_time');

-- CreateEnum
CREATE TYPE "AchievementRarity" AS ENUM ('common', 'rare', 'epic', 'legendary');

-- CreateEnum
CREATE TYPE "UserAchievementStatus" AS ENUM ('locked', 'unlocked', 'seen');

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "learningGoals" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "outputLevel" TEXT NOT NULL DEFAULT 'L1',
ADD COLUMN     "outputLevelDetail" JSONB,
ADD COLUMN     "totalXp" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "userLevel" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "scene_category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scene_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scene" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT,
    "requiredOutputLevel" TEXT NOT NULL DEFAULT 'L1',
    "requiredUserLevel" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scene_prerequisite" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "prerequisiteId" TEXT NOT NULL,

    CONSTRAINT "scene_prerequisite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chunk" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'L2',
    "example" TEXT,
    "sceneId" TEXT,
    "applicableSceneIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scene_vocabulary" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "scene_vocabulary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_chunk_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "status" "ChunkMasteryStatus" NOT NULL DEFAULT 'not_learned',
    "seenCount" INTEGER NOT NULL DEFAULT 0,
    "spokenCount" INTEGER NOT NULL DEFAULT 0,
    "correctUseCount" INTEGER NOT NULL DEFAULT 0,
    "usedSceneIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastPracticedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_chunk_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_topic" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "promptEn" TEXT NOT NULL,
    "promptZh" TEXT NOT NULL,
    "suggestedDurationSec" INTEGER NOT NULL DEFAULT 60,
    "difficulty" TEXT NOT NULL DEFAULT 'L2',
    "sentenceSkeleton" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_topic_chunk" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "training_topic_chunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "script_episode" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "chapterTitle" TEXT NOT NULL,
    "episodeOrder" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "requiredOutputLevel" TEXT NOT NULL DEFAULT 'L2',
    "requiredUserLevel" INTEGER NOT NULL DEFAULT 1,
    "vocabRequiredCount" INTEGER NOT NULL DEFAULT 6,
    "vocabTotalCount" INTEGER NOT NULL DEFAULT 10,
    "chunkRequiredCount" INTEGER NOT NULL DEFAULT 6,
    "chunkTotalCount" INTEGER NOT NULL DEFAULT 10,
    "prerequisiteEpisodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "objectives" TEXT[],
    "passObjectiveCount" INTEGER NOT NULL DEFAULT 3,
    "passChunkCount" INTEGER NOT NULL DEFAULT 3,
    "passRetellRequired" BOOLEAN NOT NULL DEFAULT true,
    "passMinDialogues" INTEGER NOT NULL DEFAULT 3,
    "rewards" JSONB,
    "npcName" TEXT NOT NULL,
    "npcRole" TEXT NOT NULL,
    "npcPersonality" TEXT,
    "inkScriptId" TEXT,
    "isPreview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "script_episode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "script_episode_vocab" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "vocabId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "script_episode_vocab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "script_episode_chunk" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "script_episode_chunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "script_dialogue" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "npcText" TEXT NOT NULL,
    "userAudioUrl" TEXT,
    "userText" TEXT,
    "isOnTopic" BOOLEAN,
    "objectiveCompleted" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "chunksUsed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "grammarIssues" JSONB,
    "needsFollowUp" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "script_dialogue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "script_record" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "objectivesDone" INTEGER NOT NULL DEFAULT 0,
    "chunksUsed" INTEGER NOT NULL DEFAULT 0,
    "dialogueRounds" INTEGER NOT NULL DEFAULT 0,
    "retellCompleted" BOOLEAN NOT NULL DEFAULT false,
    "aiFeedback" JSONB,
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "script_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expression_item" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ExpressionType" NOT NULL DEFAULT 'chunk',
    "original" TEXT,
    "corrected" TEXT,
    "chunkText" TEXT,
    "sceneName" TEXT,
    "masteryStatus" TEXT NOT NULL DEFAULT 'activated',
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "lastReviewedAt" TIMESTAMP(3),
    "nextReviewAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expression_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_scene_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "readiness" INTEGER NOT NULL DEFAULT 0,
    "mastery" INTEGER NOT NULL DEFAULT 0,
    "vocabLearned" INTEGER NOT NULL DEFAULT 0,
    "vocabTotal" INTEGER NOT NULL DEFAULT 0,
    "chunkMastered" INTEGER NOT NULL DEFAULT 0,
    "chunkTotal" INTEGER NOT NULL DEFAULT 0,
    "completedPracticeCount" INTEGER NOT NULL DEFAULT 0,
    "completedScriptCount" INTEGER NOT NULL DEFAULT 0,
    "prerequisiteCompleted" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_scene_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_status" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goalsSelected" BOOLEAN NOT NULL DEFAULT false,
    "abilitySelected" BOOLEAN NOT NULL DEFAULT false,
    "diagnosticDone" BOOLEAN NOT NULL DEFAULT false,
    "tutorialDone" BOOLEAN NOT NULL DEFAULT false,
    "diagnosticResult" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_character" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "personality" TEXT,
    "avatarUrl" TEXT,
    "spriteBaseUrl" TEXT,
    "expressions" JSONB,
    "defaultPosition" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_map" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "backgroundUrl" TEXT,
    "thumbnailUrl" TEXT,
    "width" INTEGER NOT NULL DEFAULT 1920,
    "height" INTEGER NOT NULL DEFAULT 1080,
    "requiredOutputLevel" TEXT NOT NULL DEFAULT 'L1',
    "requiredChapterId" TEXT,
    "isPreview" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_map_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_location" (
    "id" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "posX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "posY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "icon" TEXT,
    "backgroundUrl" TEXT,
    "bgmUrl" TEXT,
    "ambientUrl" TEXT,
    "locationType" TEXT NOT NULL DEFAULT 'vn_scene',
    "sceneId" TEXT,
    "inkScriptId" TEXT,
    "requiredOutputLevel" TEXT NOT NULL DEFAULT 'L1',
    "requiredSceneIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requiredFlags" JSONB,
    "isPreview" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_location_exit" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "requiredFlags" JSONB,

    CONSTRAINT "game_location_exit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_location_npc" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "schedule" JSONB,
    "defaultGreeting" TEXT,
    "inkTalkScriptId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "game_location_npc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ink_script" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scriptType" TEXT NOT NULL DEFAULT 'episode',
    "inkJson" JSONB NOT NULL,
    "inkSource" TEXT,
    "episodeId" TEXT,
    "locationId" TEXT,
    "characterId" TEXT,
    "declaredVariables" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "changelog" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ink_script_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_save" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inkState" JSONB,
    "currentMapId" TEXT,
    "currentLocationId" TEXT,
    "visitedLocationIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "flags" JSONB,
    "saveName" TEXT NOT NULL DEFAULT '自动存档',
    "playTimeSeconds" INTEGER NOT NULL DEFAULT 0,
    "slot" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_save_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exploration_record" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "userText" TEXT NOT NULL,
    "npcReply" TEXT,
    "feedback" JSONB,
    "isInkDriven" BOOLEAN NOT NULL DEFAULT false,
    "inkKnotName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exploration_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievement_def" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "AchievementCategory" NOT NULL DEFAULT 'milestone',
    "rarity" "AchievementRarity" NOT NULL DEFAULT 'common',
    "icon" TEXT,
    "condition" JSONB NOT NULL,
    "rewardXp" INTEGER NOT NULL DEFAULT 0,
    "rewardTitle" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "hintText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievement_def_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_achievement_v2" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "status" "UserAchievementStatus" NOT NULL DEFAULT 'locked',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "progressTarget" INTEGER NOT NULL DEFAULT 0,
    "unlockedAt" TIMESTAMP(3),
    "seenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_achievement_v2_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scene_prerequisite_sceneId_prerequisiteId_key" ON "scene_prerequisite"("sceneId", "prerequisiteId");

-- CreateIndex
CREATE INDEX "chunk_sceneId_idx" ON "chunk"("sceneId");

-- CreateIndex
CREATE INDEX "chunk_difficulty_idx" ON "chunk"("difficulty");

-- CreateIndex
CREATE INDEX "scene_vocabulary_sceneId_idx" ON "scene_vocabulary"("sceneId");

-- CreateIndex
CREATE UNIQUE INDEX "user_chunk_progress_userId_chunkId_key" ON "user_chunk_progress"("userId", "chunkId");

-- CreateIndex
CREATE INDEX "training_topic_sceneId_difficulty_idx" ON "training_topic"("sceneId", "difficulty");

-- CreateIndex
CREATE UNIQUE INDEX "training_topic_chunk_topicId_chunkId_key" ON "training_topic_chunk"("topicId", "chunkId");

-- CreateIndex
CREATE INDEX "script_episode_chapterId_episodeOrder_idx" ON "script_episode"("chapterId", "episodeOrder");

-- CreateIndex
CREATE UNIQUE INDEX "script_episode_vocab_episodeId_vocabId_key" ON "script_episode_vocab"("episodeId", "vocabId");

-- CreateIndex
CREATE UNIQUE INDEX "script_episode_chunk_episodeId_chunkId_key" ON "script_episode_chunk"("episodeId", "chunkId");

-- CreateIndex
CREATE INDEX "script_dialogue_episodeId_userId_round_idx" ON "script_dialogue"("episodeId", "userId", "round");

-- CreateIndex
CREATE INDEX "script_record_userId_createdAt_idx" ON "script_record"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "script_record_userId_episodeId_key" ON "script_record"("userId", "episodeId");

-- CreateIndex
CREATE INDEX "expression_item_userId_type_idx" ON "expression_item"("userId", "type");

-- CreateIndex
CREATE INDEX "expression_item_userId_nextReviewAt_idx" ON "expression_item"("userId", "nextReviewAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_scene_progress_userId_sceneId_key" ON "user_scene_progress"("userId", "sceneId");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_status_userId_key" ON "onboarding_status"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "game_location_exit_fromId_toId_key" ON "game_location_exit"("fromId", "toId");

-- CreateIndex
CREATE UNIQUE INDEX "game_location_npc_locationId_characterId_key" ON "game_location_npc"("locationId", "characterId");

-- CreateIndex
CREATE UNIQUE INDEX "ink_script_key_key" ON "ink_script"("key");

-- CreateIndex
CREATE INDEX "ink_script_scriptType_idx" ON "ink_script"("scriptType");

-- CreateIndex
CREATE INDEX "ink_script_episodeId_idx" ON "ink_script"("episodeId");

-- CreateIndex
CREATE INDEX "ink_script_locationId_idx" ON "ink_script"("locationId");

-- CreateIndex
CREATE INDEX "game_save_userId_updatedAt_idx" ON "game_save"("userId", "updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "game_save_userId_slot_key" ON "game_save"("userId", "slot");

-- CreateIndex
CREATE INDEX "exploration_record_userId_createdAt_idx" ON "exploration_record"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "achievement_def_key_key" ON "achievement_def"("key");

-- CreateIndex
CREATE INDEX "user_achievement_v2_userId_status_idx" ON "user_achievement_v2"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "user_achievement_v2_userId_achievementId_key" ON "user_achievement_v2"("userId", "achievementId");

-- AddForeignKey
ALTER TABLE "scene" ADD CONSTRAINT "scene_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "scene_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_prerequisite" ADD CONSTRAINT "scene_prerequisite_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scene"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_prerequisite" ADD CONSTRAINT "scene_prerequisite_prerequisiteId_fkey" FOREIGN KEY ("prerequisiteId") REFERENCES "scene"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chunk" ADD CONSTRAINT "chunk_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scene"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_vocabulary" ADD CONSTRAINT "scene_vocabulary_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scene"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_chunk_progress" ADD CONSTRAINT "user_chunk_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_chunk_progress" ADD CONSTRAINT "user_chunk_progress_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "chunk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_topic" ADD CONSTRAINT "training_topic_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scene"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_topic_chunk" ADD CONSTRAINT "training_topic_chunk_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "training_topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_topic_chunk" ADD CONSTRAINT "training_topic_chunk_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "chunk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_episode" ADD CONSTRAINT "script_episode_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scene"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_episode_vocab" ADD CONSTRAINT "script_episode_vocab_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "script_episode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_episode_vocab" ADD CONSTRAINT "script_episode_vocab_vocabId_fkey" FOREIGN KEY ("vocabId") REFERENCES "scene_vocabulary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_episode_chunk" ADD CONSTRAINT "script_episode_chunk_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "script_episode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_episode_chunk" ADD CONSTRAINT "script_episode_chunk_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "chunk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_dialogue" ADD CONSTRAINT "script_dialogue_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "script_episode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_dialogue" ADD CONSTRAINT "script_dialogue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_record" ADD CONSTRAINT "script_record_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_record" ADD CONSTRAINT "script_record_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "script_episode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expression_item" ADD CONSTRAINT "expression_item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_scene_progress" ADD CONSTRAINT "user_scene_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_scene_progress" ADD CONSTRAINT "user_scene_progress_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scene"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_status" ADD CONSTRAINT "onboarding_status_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_location" ADD CONSTRAINT "game_location_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "game_map"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_location" ADD CONSTRAINT "game_location_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scene"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_location_exit" ADD CONSTRAINT "game_location_exit_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "game_location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_location_exit" ADD CONSTRAINT "game_location_exit_toId_fkey" FOREIGN KEY ("toId") REFERENCES "game_location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_location_npc" ADD CONSTRAINT "game_location_npc_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "game_location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_location_npc" ADD CONSTRAINT "game_location_npc_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "game_character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_save" ADD CONSTRAINT "game_save_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exploration_record" ADD CONSTRAINT "exploration_record_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exploration_record" ADD CONSTRAINT "exploration_record_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "game_character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exploration_record" ADD CONSTRAINT "exploration_record_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "game_location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievement_v2" ADD CONSTRAINT "user_achievement_v2_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievement_v2" ADD CONSTRAINT "user_achievement_v2_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "achievement_def"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
