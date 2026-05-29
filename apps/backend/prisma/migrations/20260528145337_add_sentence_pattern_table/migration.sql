/*
  Warnings:

  - You are about to drop the column `sentencePatterns` on the `training_topic` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[inkScriptId]` on the table `training_topic` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "ExpressionType" ADD VALUE 'word';

-- AlterTable
ALTER TABLE "ink_script" ADD COLUMN     "topicId" TEXT;

-- AlterTable
ALTER TABLE "scene_vocabulary" ADD COLUMN     "audioUkUrl" TEXT,
ADD COLUMN     "audioUsUrl" TEXT,
ADD COLUMN     "definitionEn" TEXT,
ADD COLUMN     "difficulty" TEXT NOT NULL DEFAULT 'L1',
ADD COLUMN     "examples" JSONB,
ADD COLUMN     "partOfSpeech" TEXT,
ADD COLUMN     "phoneticUk" TEXT,
ADD COLUMN     "phoneticUs" TEXT,
ADD COLUMN     "synonyms" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "training_topic" DROP COLUMN "sentencePatterns",
ADD COLUMN     "inkScriptId" TEXT,
ADD COLUMN     "knowledgePoints" TEXT,
ADD COLUMN     "sentence_patterns" JSONB;

-- AlterTable
ALTER TABLE "user_preference" ADD COLUMN     "themePresetId" TEXT;

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
CREATE TABLE "training_topic_sentence_pattern" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "meaning" TEXT,
    "slots" JSONB,
    "example" TEXT,
    "difficulty" TEXT NOT NULL DEFAULT 'L1',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_topic_sentence_pattern_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_sentence_date_key" ON "daily_sentence"("date");

-- CreateIndex
CREATE INDEX "daily_sentence_date_sortOrder_idx" ON "daily_sentence"("date", "sortOrder");

-- CreateIndex
CREATE INDEX "training_topic_sentence_pattern_topicId_sortOrder_idx" ON "training_topic_sentence_pattern"("topicId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "training_topic_inkScriptId_key" ON "training_topic"("inkScriptId");

-- AddForeignKey
ALTER TABLE "user_preference" ADD CONSTRAINT "user_preference_themePresetId_fkey" FOREIGN KEY ("themePresetId") REFERENCES "theme_preset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_topic" ADD CONSTRAINT "training_topic_inkScriptId_fkey" FOREIGN KEY ("inkScriptId") REFERENCES "ink_script"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_topic_sentence_pattern" ADD CONSTRAINT "training_topic_sentence_pattern_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "training_topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
