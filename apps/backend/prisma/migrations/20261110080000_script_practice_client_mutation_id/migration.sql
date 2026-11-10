-- AlterTable
ALTER TABLE "script_practice_record" ADD COLUMN "clientMutationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "script_practice_record_userId_clientMutationId_key" ON "script_practice_record"("userId", "clientMutationId");
