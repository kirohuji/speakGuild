CREATE TYPE "LearningNotebookKind" AS ENUM ('custom', 'uncategorized');

CREATE TABLE "learning_notebook" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "LearningNotebookKind" NOT NULL DEFAULT 'custom',
    "color" TEXT NOT NULL DEFAULT 'ocean',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "learning_notebook_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "learning_notebook_item" (
    "id" TEXT NOT NULL,
    "notebookId" TEXT NOT NULL,
    "expressionItemId" TEXT NOT NULL,
    "masteryStatus" TEXT NOT NULL DEFAULT 'learning',
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "lastReviewedAt" TIMESTAMP(3),
    "nextReviewAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "learning_notebook_item_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "learning_notebook_userId_sortOrder_idx"
ON "learning_notebook"("userId", "sortOrder");

CREATE INDEX "learning_notebook_userId_kind_idx"
ON "learning_notebook"("userId", "kind");

CREATE INDEX "learning_notebook_userId_deletedAt_idx"
ON "learning_notebook"("userId", "deletedAt");

CREATE UNIQUE INDEX "learning_notebook_one_uncategorized_per_user"
ON "learning_notebook"("userId")
WHERE "kind" = 'uncategorized' AND "deletedAt" IS NULL;

CREATE UNIQUE INDEX "learning_notebook_item_notebookId_expressionItemId_key"
ON "learning_notebook_item"("notebookId", "expressionItemId");

CREATE INDEX "learning_notebook_item_notebookId_masteryStatus_idx"
ON "learning_notebook_item"("notebookId", "masteryStatus");

CREATE INDEX "learning_notebook_item_expressionItemId_idx"
ON "learning_notebook_item"("expressionItemId");

CREATE INDEX "learning_notebook_item_updatedAt_idx"
ON "learning_notebook_item"("updatedAt");

CREATE INDEX "learning_notebook_item_deletedAt_idx"
ON "learning_notebook_item"("deletedAt");

ALTER TABLE "learning_notebook"
ADD CONSTRAINT "learning_notebook_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "user"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "learning_notebook_item"
ADD CONSTRAINT "learning_notebook_item_notebookId_fkey"
FOREIGN KEY ("notebookId") REFERENCES "learning_notebook"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "learning_notebook_item"
ADD CONSTRAINT "learning_notebook_item_expressionItemId_fkey"
FOREIGN KEY ("expressionItemId") REFERENCES "expression_item"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
