-- AlterTable: make Feedback.userId optional for anonymous feedback support
ALTER TABLE "feedback" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable: set default value for Feedback.type
ALTER TABLE "feedback" ALTER COLUMN "type" SET DEFAULT 'other';

-- DropForeignKey: change onDelete from Cascade to SetNull for anonymous entries
ALTER TABLE "feedback" DROP CONSTRAINT IF EXISTS "feedback_userId_fkey";
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
