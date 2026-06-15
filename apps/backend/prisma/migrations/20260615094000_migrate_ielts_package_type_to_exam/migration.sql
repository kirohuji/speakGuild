UPDATE "scene"
SET "packageType" = 'exam'
WHERE "packageType"::text = 'ielts';

UPDATE "learning_package"
SET "type" = 'exam'
WHERE "type"::text = 'ielts';
