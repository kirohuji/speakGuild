/*
  Warnings:

  - You are about to drop the column `feedback` on the `ai_usage_daily` table. All the data in the column will be lost.
  - You are about to drop the column `sourceQuestionId` on the `vocabulary_word` table. All the data in the column will be lost.
  - You are about to drop the `favorite_question` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `mock_exam_record` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `mock_paper` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `mock_paper_question` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `onboarding_status` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `practice_progress` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `practice_record` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `question_audio` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `question_bank` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `question_content` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `question_item` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `question_topic` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_binding_config` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
ALTER TYPE "FileAssetGroup" ADD VALUE 'mobile_bundle';

-- DropForeignKey
ALTER TABLE "favorite_question" DROP CONSTRAINT "favorite_question_questionId_fkey";

-- DropForeignKey
ALTER TABLE "favorite_question" DROP CONSTRAINT "favorite_question_userId_fkey";

-- DropForeignKey
ALTER TABLE "mock_exam_record" DROP CONSTRAINT "mock_exam_record_paperId_fkey";

-- DropForeignKey
ALTER TABLE "mock_exam_record" DROP CONSTRAINT "mock_exam_record_userId_fkey";

-- DropForeignKey
ALTER TABLE "mock_paper" DROP CONSTRAINT "mock_paper_bankId_fkey";

-- DropForeignKey
ALTER TABLE "mock_paper_question" DROP CONSTRAINT "mock_paper_question_paperId_fkey";

-- DropForeignKey
ALTER TABLE "mock_paper_question" DROP CONSTRAINT "mock_paper_question_questionId_fkey";

-- DropForeignKey
ALTER TABLE "onboarding_status" DROP CONSTRAINT "onboarding_status_userId_fkey";

-- DropForeignKey
ALTER TABLE "practice_progress" DROP CONSTRAINT "practice_progress_questionId_fkey";

-- DropForeignKey
ALTER TABLE "practice_progress" DROP CONSTRAINT "practice_progress_userId_fkey";

-- DropForeignKey
ALTER TABLE "practice_record" DROP CONSTRAINT "practice_record_questionId_fkey";

-- DropForeignKey
ALTER TABLE "practice_record" DROP CONSTRAINT "practice_record_userId_fkey";

-- DropForeignKey
ALTER TABLE "question_audio" DROP CONSTRAINT "question_audio_assetId_fkey";

-- DropForeignKey
ALTER TABLE "question_audio" DROP CONSTRAINT "question_audio_questionId_fkey";

-- DropForeignKey
ALTER TABLE "question_content" DROP CONSTRAINT "question_content_questionId_fkey";

-- DropForeignKey
ALTER TABLE "question_item" DROP CONSTRAINT "question_item_topicId_fkey";

-- DropForeignKey
ALTER TABLE "question_topic" DROP CONSTRAINT "question_topic_bankId_fkey";

-- DropForeignKey
ALTER TABLE "user_binding_config" DROP CONSTRAINT "user_binding_config_bankId_fkey";

-- DropForeignKey
ALTER TABLE "user_binding_config" DROP CONSTRAINT "user_binding_config_userId_fkey";

-- DropForeignKey
ALTER TABLE "vocabulary_word" DROP CONSTRAINT "vocabulary_word_sourceQuestionId_fkey";

-- AlterTable
ALTER TABLE "ai_usage_daily" DROP COLUMN "feedback",
ADD COLUMN     "tokens" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "hasCompletedOnboarding" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "vocabulary_word" DROP COLUMN "sourceQuestionId";

-- DropTable
DROP TABLE "favorite_question";

-- DropTable
DROP TABLE "mock_exam_record";

-- DropTable
DROP TABLE "mock_paper";

-- DropTable
DROP TABLE "mock_paper_question";

-- DropTable
DROP TABLE "onboarding_status";

-- DropTable
DROP TABLE "practice_progress";

-- DropTable
DROP TABLE "practice_record";

-- DropTable
DROP TABLE "question_audio";

-- DropTable
DROP TABLE "question_bank";

-- DropTable
DROP TABLE "question_content";

-- DropTable
DROP TABLE "question_item";

-- DropTable
DROP TABLE "question_topic";

-- DropTable
DROP TABLE "user_binding_config";

-- CreateTable
CREATE TABLE "word_enrichment" (
    "word" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "word_enrichment_pkey" PRIMARY KEY ("word")
);
