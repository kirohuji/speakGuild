ALTER TABLE "expression_item"
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "expression_item_userId_updatedAt_idx" ON "expression_item"("userId", "updatedAt");
CREATE INDEX "expression_item_userId_deletedAt_idx" ON "expression_item"("userId", "deletedAt");
