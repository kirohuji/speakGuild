-- Owner key migration: deviceId -> userId (dev: truncates user-domain tables)
BEGIN;

TRUNCATE TABLE "file_reference" CASCADE;
TRUNCATE TABLE "favorite_question" CASCADE;
TRUNCATE TABLE "vocabulary_word" CASCADE;
TRUNCATE TABLE "practice_record" CASCADE;
TRUNCATE TABLE "practice_progress" CASCADE;
TRUNCATE TABLE "mock_exam_record" CASCADE;
TRUNCATE TABLE "daily_activity" CASCADE;
TRUNCATE TABLE "user_preference" CASCADE;
TRUNCATE TABLE "user_binding_config" CASCADE;

-- favorite_question
DROP INDEX IF EXISTS "favorite_question_deviceId_createdAt_idx";
DROP INDEX IF EXISTS "favorite_question_deviceId_questionId_key";
ALTER TABLE "favorite_question" RENAME COLUMN "deviceId" TO "userId";
CREATE INDEX "favorite_question_userId_createdAt_idx" ON "favorite_question"("userId", "createdAt" DESC);
CREATE UNIQUE INDEX "favorite_question_userId_questionId_key" ON "favorite_question"("userId", "questionId");
ALTER TABLE "favorite_question" ADD CONSTRAINT "favorite_question_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- vocabulary_word
DROP INDEX IF EXISTS "vocabulary_word_deviceId_createdAt_idx";
DROP INDEX IF EXISTS "vocabulary_word_deviceId_term_key";
ALTER TABLE "vocabulary_word" RENAME COLUMN "deviceId" TO "userId";
CREATE INDEX "vocabulary_word_userId_createdAt_idx" ON "vocabulary_word"("userId", "createdAt" DESC);
CREATE UNIQUE INDEX "vocabulary_word_userId_term_key" ON "vocabulary_word"("userId", "term");
ALTER TABLE "vocabulary_word" ADD CONSTRAINT "vocabulary_word_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- practice_record
DROP INDEX IF EXISTS "practice_record_deviceId_createdAt_idx";
ALTER TABLE "practice_record" RENAME COLUMN "deviceId" TO "userId";
CREATE INDEX "practice_record_userId_createdAt_idx" ON "practice_record"("userId", "createdAt" DESC);
ALTER TABLE "practice_record" ADD CONSTRAINT "practice_record_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- practice_progress
DROP INDEX IF EXISTS "practice_progress_deviceId_questionId_key";
ALTER TABLE "practice_progress" RENAME COLUMN "deviceId" TO "userId";
CREATE UNIQUE INDEX "practice_progress_userId_questionId_key" ON "practice_progress"("userId", "questionId");
ALTER TABLE "practice_progress" ADD CONSTRAINT "practice_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- mock_exam_record
DROP INDEX IF EXISTS "mock_exam_record_deviceId_takenAt_idx";
ALTER TABLE "mock_exam_record" RENAME COLUMN "deviceId" TO "userId";
CREATE INDEX "mock_exam_record_userId_takenAt_idx" ON "mock_exam_record"("userId", "takenAt" DESC);
ALTER TABLE "mock_exam_record" ADD CONSTRAINT "mock_exam_record_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- daily_activity
DROP INDEX IF EXISTS "daily_activity_deviceId_date_key";
ALTER TABLE "daily_activity" RENAME COLUMN "deviceId" TO "userId";
CREATE UNIQUE INDEX "daily_activity_userId_date_key" ON "daily_activity"("userId", "date");
ALTER TABLE "daily_activity" ADD CONSTRAINT "daily_activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- user_preference
DROP INDEX IF EXISTS "user_preference_deviceId_key";
ALTER TABLE "user_preference" RENAME COLUMN "deviceId" TO "userId";
CREATE UNIQUE INDEX "user_preference_userId_key" ON "user_preference"("userId");
ALTER TABLE "user_preference" ADD CONSTRAINT "user_preference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- file_reference
DROP INDEX IF EXISTS "file_reference_bizType_bizId_deviceId_idx";
DROP INDEX IF EXISTS "file_reference_assetId_bizType_bizId_deviceId_key";
ALTER TABLE "file_reference" RENAME COLUMN "deviceId" TO "userId";
CREATE INDEX "file_reference_bizType_bizId_userId_idx" ON "file_reference"("bizType", "bizId", "userId");
CREATE UNIQUE INDEX "file_reference_assetId_bizType_bizId_userId_key" ON "file_reference"("assetId", "bizType", "bizId", "userId");
ALTER TABLE "file_reference" ADD CONSTRAINT "file_reference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- user_binding_config: remove deviceId, require userId
DROP INDEX IF EXISTS "user_binding_config_deviceId_key";
ALTER TABLE "user_binding_config" DROP COLUMN "deviceId";
ALTER TABLE "user_binding_config" ALTER COLUMN "userId" SET NOT NULL;

COMMIT;
