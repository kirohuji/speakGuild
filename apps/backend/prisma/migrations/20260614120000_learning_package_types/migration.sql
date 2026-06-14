DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LearningPackageType') THEN
    CREATE TYPE "LearningPackageType" AS ENUM ('daily', 'story', 'ielts');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TrainingTopicType') THEN
    CREATE TYPE "TrainingTopicType" AS ENUM ('daily', 'ielts');
  END IF;
END $$;

ALTER TABLE "scene"
  ADD COLUMN IF NOT EXISTS "packageType" "LearningPackageType" NOT NULL DEFAULT 'daily';

ALTER TABLE "learning_package"
  ADD COLUMN IF NOT EXISTS "type" "LearningPackageType" NOT NULL DEFAULT 'daily';

ALTER TABLE "training_topic"
  ADD COLUMN IF NOT EXISTS "type" "TrainingTopicType" NOT NULL DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS "metadata" JSONB;

UPDATE "learning_package" lp
SET "type" = s."packageType"
FROM "scene" s
WHERE lp."sceneId" = s."id";
