DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LearningPackageType' AND e.enumlabel = 'exam'
  ) THEN
    ALTER TYPE "LearningPackageType" ADD VALUE 'exam';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LearningPackageType' AND e.enumlabel = 'course'
  ) THEN
    ALTER TYPE "LearningPackageType" ADD VALUE 'course';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'LearningPackageType' AND e.enumlabel = 'foundation'
  ) THEN
    ALTER TYPE "LearningPackageType" ADD VALUE 'foundation';
  END IF;
END $$;
