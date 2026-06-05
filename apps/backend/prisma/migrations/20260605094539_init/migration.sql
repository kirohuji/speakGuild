-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "MembershipLevel" AS ENUM ('free', 'standard', 'advanced');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'paid', 'cancelled', 'refunded');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('alipay', 'wechat');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('active', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "FileAssetGroup" AS ENUM ('avatar', 'library', 'tts', 'notification', 'mobile_bundle');

-- CreateEnum
CREATE TYPE "FileAssetStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "TtsProvider" AS ENUM ('minimax', 'cartesia');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('broadcast', 'targeted');

-- CreateEnum
CREATE TYPE "CouponType" AS ENUM ('percentage', 'fixed', 'free_trial');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('pending', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "ChunkMasteryStatus" AS ENUM ('not_learned', 'activated', 'can_read', 'can_output', 'mastered');

-- CreateEnum
CREATE TYPE "ExpressionType" AS ENUM ('word', 'chunk', 'error_sentence', 'upgraded', 'scene_phrase', 'custom');

-- CreateEnum
CREATE TYPE "AchievementCategory" AS ENUM ('milestone', 'streak', 'challenge', 'mastery', 'hidden', 'first_time');

-- CreateEnum
CREATE TYPE "AchievementRarity" AS ENUM ('common', 'rare', 'epic', 'legendary');

-- CreateEnum
CREATE TYPE "UserAchievementStatus" AS ENUM ('locked', 'unlocked', 'seen');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "username" TEXT,
    "phoneNumber" TEXT,
    "phoneNumberVerified" BOOLEAN NOT NULL DEFAULT false,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "hasCompletedOnboarding" BOOLEAN NOT NULL DEFAULT false,
    "learningGoals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "outputLevel" TEXT NOT NULL DEFAULT 'L1',
    "outputLevelDetail" JSONB,
    "totalXp" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "userLevel" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_activity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "daily_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "autoPlay" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT NOT NULL DEFAULT 'zh-CN',
    "theme" TEXT NOT NULL DEFAULT 'system',
    "themePresetId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "theme_preset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "bgType" TEXT NOT NULL DEFAULT 'gradient',
    "lightColors" JSONB,
    "lightBackground" TEXT,
    "lightDecorations" JSONB,
    "darkColors" JSONB,
    "darkBackground" TEXT,
    "darkDecorations" JSONB,
    "bgmUrl" TEXT,
    "bgmVolume" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "theme_preset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_config" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '',
    "group" TEXT NOT NULL DEFAULT 'basic',
    "label" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'string',
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_sentence" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "quote" TEXT NOT NULL,
    "translation" TEXT NOT NULL,
    "author" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_sentence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" "MembershipLevel" NOT NULL DEFAULT 'standard',
    "price" INTEGER NOT NULL,
    "yearlyPrice" INTEGER,
    "period" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL DEFAULT 30,
    "features" TEXT[],
    "revenueCatEntitlementId" TEXT,
    "highlighted" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "paymentRef" TEXT,
    "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
    "paidAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "couponId" TEXT,

    CONSTRAINT "order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'active',
    "orderId" TEXT,
    "rcCustomerId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiredAt" TIMESTAMP(3) NOT NULL,
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_asset" (
    "id" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "cosKey" TEXT NOT NULL,
    "group" "FileAssetGroup" NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "status" "FileAssetStatus" NOT NULL DEFAULT 'active',
    "refCount" INTEGER NOT NULL DEFAULT 0,
    "lastReferencedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_reference" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "bizType" TEXT NOT NULL,
    "bizId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_reference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "sentById" TEXT NOT NULL,
    "isSpecial" BOOLEAN NOT NULL DEFAULT false,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_read" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_read_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_target" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "notification_target_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "CouponType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "minAmount" DOUBLE PRECISION,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_code" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "totalInvited" INTEGER NOT NULL DEFAULT 0,
    "totalReward" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "rewardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievement" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "condition" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_achievement" (
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_achievement_pkey" PRIMARY KEY ("userId","achievementId")
);

-- CreateTable
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'other',
    "content" TEXT NOT NULL,
    "contact" TEXT,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'pending',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

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
    "isFree" BOOLEAN NOT NULL DEFAULT false,
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
    "description" TEXT,
    "category" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'L2',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocabulary" (
    "id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "partOfSpeech" TEXT,
    "phoneticUs" TEXT,
    "phoneticUk" TEXT,
    "audioUsUrl" TEXT,
    "audioUkUrl" TEXT,
    "definitionEn" TEXT,
    "synonyms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "examples" JSONB,
    "description" TEXT,
    "difficulty" TEXT NOT NULL DEFAULT 'L1',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "vocabulary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_topic_vocab" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "vocabId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "training_topic_vocab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chunk_example" (
    "id" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "en" TEXT NOT NULL,
    "zh" TEXT NOT NULL,
    "note" TEXT,
    "level" TEXT NOT NULL DEFAULT 'basic',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chunk_example_pkey" PRIMARY KEY ("id")
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
    "description" TEXT,
    "knowledgePoints" TEXT,
    "teachingMarkdown" TEXT,
    "promptEn" TEXT NOT NULL,
    "promptZh" TEXT NOT NULL,
    "suggestedDurationSec" INTEGER NOT NULL DEFAULT 60,
    "difficulty" TEXT NOT NULL DEFAULT 'L2',
    "sentence_patterns" JSONB,
    "inkScriptId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sentence_pattern" (
    "id" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "meaning" TEXT,
    "slots" JSONB,
    "example" TEXT,
    "difficulty" TEXT NOT NULL DEFAULT 'L1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sentence_pattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_topic_sentence_pattern" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "patternId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "training_topic_sentence_pattern_pkey" PRIMARY KEY ("id")
);

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
    "description" TEXT,
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
CREATE TABLE "script_episode_sentence_pattern" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "patternId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "script_episode_sentence_pattern_pkey" PRIMARY KEY ("id")
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
    "masteryStatus" TEXT NOT NULL DEFAULT 'learning',
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "lastReviewedAt" TIMESTAMP(3),
    "nextReviewAt" TIMESTAMP(3),
    "sourceType" TEXT,
    "sourceId" TEXT,
    "sourceSnapshot" JSONB,
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
    "ttsVoice" TEXT,
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
    "inkJson" JSONB,
    "inkSource" TEXT,
    "episodeId" TEXT,
    "locationId" TEXT,
    "characterId" TEXT,
    "topicId" TEXT,
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

-- CreateTable
CREATE TABLE "user_check_in" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 10,
    "streak" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_check_in_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "description" TEXT,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_daily" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dialogue" INTEGER NOT NULL DEFAULT 0,
    "summary" INTEGER NOT NULL DEFAULT 0,
    "tokens" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ai_usage_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mobile_bundle" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'production',
    "assetId" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "minNativeVersion" TEXT,
    "rolloutPercent" INTEGER NOT NULL DEFAULT 100,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isMandatory" BOOLEAN NOT NULL DEFAULT false,
    "releaseNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mobile_bundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "word_enrichment" (
    "word" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "word_enrichment_pkey" PRIMARY KEY ("word")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_phoneNumber_key" ON "user"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "daily_activity_userId_date_key" ON "daily_activity"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "user_preference_userId_key" ON "user_preference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "system_config_key_key" ON "system_config"("key");

-- CreateIndex
CREATE UNIQUE INDEX "daily_sentence_date_key" ON "daily_sentence"("date");

-- CreateIndex
CREATE INDEX "daily_sentence_date_sortOrder_idx" ON "daily_sentence"("date", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "order_orderNo_key" ON "order"("orderNo");

-- CreateIndex
CREATE INDEX "order_userId_createdAt_idx" ON "order"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "order_status_idx" ON "order"("status");

-- CreateIndex
CREATE UNIQUE INDEX "user_membership_userId_key" ON "user_membership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_membership_orderId_key" ON "user_membership"("orderId");

-- CreateIndex
CREATE INDEX "user_membership_status_expiredAt_idx" ON "user_membership"("status", "expiredAt");

-- CreateIndex
CREATE UNIQUE INDEX "file_asset_sha256_key" ON "file_asset"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "file_asset_cosKey_key" ON "file_asset"("cosKey");

-- CreateIndex
CREATE INDEX "file_asset_group_status_createdAt_idx" ON "file_asset"("group", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "file_asset_status_refCount_createdAt_idx" ON "file_asset"("status", "refCount", "createdAt");

-- CreateIndex
CREATE INDEX "file_reference_bizType_bizId_userId_idx" ON "file_reference"("bizType", "bizId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "file_reference_assetId_bizType_bizId_userId_key" ON "file_reference"("assetId", "bizType", "bizId", "userId");

-- CreateIndex
CREATE INDEX "notification_type_createdAt_idx" ON "notification"("type", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "notification_read_userId_readAt_idx" ON "notification_read"("userId", "readAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "notification_read_notificationId_userId_key" ON "notification_read"("notificationId", "userId");

-- CreateIndex
CREATE INDEX "notification_target_userId_idx" ON "notification_target"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_target_notificationId_userId_key" ON "notification_target"("notificationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_code_key" ON "coupon"("code");

-- CreateIndex
CREATE UNIQUE INDEX "referral_code_userId_key" ON "referral_code"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "referral_code_code_key" ON "referral_code"("code");

-- CreateIndex
CREATE UNIQUE INDEX "referral_referredUserId_key" ON "referral"("referredUserId");

-- CreateIndex
CREATE INDEX "referral_referrerId_idx" ON "referral"("referrerId");

-- CreateIndex
CREATE UNIQUE INDEX "achievement_key_key" ON "achievement"("key");

-- CreateIndex
CREATE INDEX "user_achievement_userId_idx" ON "user_achievement"("userId");

-- CreateIndex
CREATE INDEX "feedback_userId_createdAt_idx" ON "feedback"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "feedback_status_idx" ON "feedback"("status");

-- CreateIndex
CREATE UNIQUE INDEX "scene_prerequisite_sceneId_prerequisiteId_key" ON "scene_prerequisite"("sceneId", "prerequisiteId");

-- CreateIndex
CREATE INDEX "chunk_difficulty_idx" ON "chunk"("difficulty");

-- CreateIndex
CREATE UNIQUE INDEX "training_topic_vocab_topicId_vocabId_key" ON "training_topic_vocab"("topicId", "vocabId");

-- CreateIndex
CREATE INDEX "chunk_example_chunkId_sortOrder_idx" ON "chunk_example"("chunkId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "user_chunk_progress_userId_chunkId_key" ON "user_chunk_progress"("userId", "chunkId");

-- CreateIndex
CREATE UNIQUE INDEX "training_topic_inkScriptId_key" ON "training_topic"("inkScriptId");

-- CreateIndex
CREATE INDEX "training_topic_sceneId_difficulty_idx" ON "training_topic"("sceneId", "difficulty");

-- CreateIndex
CREATE UNIQUE INDEX "sentence_pattern_pattern_key" ON "sentence_pattern"("pattern");

-- CreateIndex
CREATE INDEX "training_topic_sentence_pattern_topicId_sortOrder_idx" ON "training_topic_sentence_pattern"("topicId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "training_topic_sentence_pattern_topicId_patternId_key" ON "training_topic_sentence_pattern"("topicId", "patternId");

-- CreateIndex
CREATE INDEX "practice_session_userId_startedAt_idx" ON "practice_session"("userId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "practice_session_topicId_startedAt_idx" ON "practice_session"("topicId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "practice_session_status_idx" ON "practice_session"("status");

-- CreateIndex
CREATE INDEX "practice_turn_sessionId_round_idx" ON "practice_turn"("sessionId", "round");

-- CreateIndex
CREATE UNIQUE INDEX "training_topic_chunk_topicId_chunkId_key" ON "training_topic_chunk"("topicId", "chunkId");

-- CreateIndex
CREATE INDEX "script_episode_chapterId_episodeOrder_idx" ON "script_episode"("chapterId", "episodeOrder");

-- CreateIndex
CREATE UNIQUE INDEX "script_episode_vocab_episodeId_vocabId_key" ON "script_episode_vocab"("episodeId", "vocabId");

-- CreateIndex
CREATE UNIQUE INDEX "script_episode_chunk_episodeId_chunkId_key" ON "script_episode_chunk"("episodeId", "chunkId");

-- CreateIndex
CREATE UNIQUE INDEX "script_episode_sentence_pattern_episodeId_patternId_key" ON "script_episode_sentence_pattern"("episodeId", "patternId");

-- CreateIndex
CREATE INDEX "script_dialogue_episodeId_userId_round_idx" ON "script_dialogue"("episodeId", "userId", "round");

-- CreateIndex
CREATE INDEX "script_record_userId_createdAt_idx" ON "script_record"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "script_record_userId_episodeId_key" ON "script_record"("userId", "episodeId");

-- CreateIndex
CREATE INDEX "expression_item_userId_type_idx" ON "expression_item"("userId", "type");

-- CreateIndex
CREATE INDEX "expression_item_userId_masteryStatus_idx" ON "expression_item"("userId", "masteryStatus");

-- CreateIndex
CREATE UNIQUE INDEX "user_scene_progress_userId_sceneId_key" ON "user_scene_progress"("userId", "sceneId");

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

-- CreateIndex
CREATE INDEX "user_check_in_userId_idx" ON "user_check_in"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_check_in_userId_date_key" ON "user_check_in"("userId", "date");

-- CreateIndex
CREATE INDEX "point_transaction_userId_idx" ON "point_transaction"("userId");

-- CreateIndex
CREATE INDEX "ai_usage_daily_userId_idx" ON "ai_usage_daily"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_daily_userId_date_key" ON "ai_usage_daily"("userId", "date");

-- CreateIndex
CREATE INDEX "mobile_bundle_platform_channel_enabled_idx" ON "mobile_bundle"("platform", "channel", "enabled");

-- CreateIndex
CREATE INDEX "mobile_bundle_assetId_idx" ON "mobile_bundle"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "mobile_bundle_version_platform_channel_key" ON "mobile_bundle"("version", "platform", "channel");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_activity" ADD CONSTRAINT "daily_activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preference" ADD CONSTRAINT "user_preference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preference" ADD CONSTRAINT "user_preference_themePresetId_fkey" FOREIGN KEY ("themePresetId") REFERENCES "theme_preset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_planId_fkey" FOREIGN KEY ("planId") REFERENCES "membership_plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_membership" ADD CONSTRAINT "user_membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_membership" ADD CONSTRAINT "user_membership_planId_fkey" FOREIGN KEY ("planId") REFERENCES "membership_plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_membership" ADD CONSTRAINT "user_membership_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_reference" ADD CONSTRAINT "file_reference_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "file_asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_reference" ADD CONSTRAINT "file_reference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_read" ADD CONSTRAINT "notification_read_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_read" ADD CONSTRAINT "notification_read_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_target" ADD CONSTRAINT "notification_target_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_target" ADD CONSTRAINT "notification_target_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_code" ADD CONSTRAINT "referral_code_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral" ADD CONSTRAINT "referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "referral_code"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral" ADD CONSTRAINT "referral_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievement" ADD CONSTRAINT "user_achievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievement" ADD CONSTRAINT "user_achievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene" ADD CONSTRAINT "scene_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "scene_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_prerequisite" ADD CONSTRAINT "scene_prerequisite_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scene"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_prerequisite" ADD CONSTRAINT "scene_prerequisite_prerequisiteId_fkey" FOREIGN KEY ("prerequisiteId") REFERENCES "scene"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_topic_vocab" ADD CONSTRAINT "training_topic_vocab_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "training_topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_topic_vocab" ADD CONSTRAINT "training_topic_vocab_vocabId_fkey" FOREIGN KEY ("vocabId") REFERENCES "vocabulary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chunk_example" ADD CONSTRAINT "chunk_example_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "chunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_chunk_progress" ADD CONSTRAINT "user_chunk_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_chunk_progress" ADD CONSTRAINT "user_chunk_progress_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "chunk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_topic" ADD CONSTRAINT "training_topic_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scene"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_topic" ADD CONSTRAINT "training_topic_inkScriptId_fkey" FOREIGN KEY ("inkScriptId") REFERENCES "ink_script"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_topic_sentence_pattern" ADD CONSTRAINT "training_topic_sentence_pattern_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "training_topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_topic_sentence_pattern" ADD CONSTRAINT "training_topic_sentence_pattern_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "sentence_pattern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_session" ADD CONSTRAINT "practice_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_session" ADD CONSTRAINT "practice_session_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "training_topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_turn" ADD CONSTRAINT "practice_turn_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "practice_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_topic_chunk" ADD CONSTRAINT "training_topic_chunk_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "training_topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_topic_chunk" ADD CONSTRAINT "training_topic_chunk_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "chunk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_episode" ADD CONSTRAINT "script_episode_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scene"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_episode_vocab" ADD CONSTRAINT "script_episode_vocab_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "script_episode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_episode_vocab" ADD CONSTRAINT "script_episode_vocab_vocabId_fkey" FOREIGN KEY ("vocabId") REFERENCES "vocabulary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_episode_chunk" ADD CONSTRAINT "script_episode_chunk_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "script_episode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_episode_chunk" ADD CONSTRAINT "script_episode_chunk_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "chunk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_episode_sentence_pattern" ADD CONSTRAINT "script_episode_sentence_pattern_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "script_episode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_episode_sentence_pattern" ADD CONSTRAINT "script_episode_sentence_pattern_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "sentence_pattern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "user_check_in" ADD CONSTRAINT "user_check_in_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_transaction" ADD CONSTRAINT "point_transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_daily" ADD CONSTRAINT "ai_usage_daily_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_bundle" ADD CONSTRAINT "mobile_bundle_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "file_asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
