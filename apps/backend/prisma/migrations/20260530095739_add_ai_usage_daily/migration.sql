-- DropIndex
DROP INDEX "expression_item_userId_nextReviewAt_idx";

-- AlterTable
ALTER TABLE "expression_item" ALTER COLUMN "masteryStatus" SET DEFAULT 'learning';

-- AlterTable
ALTER TABLE "notification" ADD COLUMN     "isSpecial" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "points" INTEGER NOT NULL DEFAULT 0;

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
    "feedback" INTEGER NOT NULL DEFAULT 0,
    "dialogue" INTEGER NOT NULL DEFAULT 0,
    "summary" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ai_usage_daily_pkey" PRIMARY KEY ("id")
);

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
CREATE INDEX "expression_item_userId_masteryStatus_idx" ON "expression_item"("userId", "masteryStatus");

-- AddForeignKey
ALTER TABLE "user_check_in" ADD CONSTRAINT "user_check_in_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_transaction" ADD CONSTRAINT "point_transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_daily" ADD CONSTRAINT "ai_usage_daily_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
