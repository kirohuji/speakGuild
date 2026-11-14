CREATE TABLE "notebook_sync_receipt" (
    "userId" TEXT NOT NULL,
    "clientMutationId" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notebook_sync_receipt_pkey" PRIMARY KEY ("userId", "clientMutationId")
);

ALTER TABLE "learning_notebook" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "learning_notebook_item" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "notebook_sync_receipt" ADD CONSTRAINT "notebook_sync_receipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
