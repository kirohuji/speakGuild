ALTER TABLE "user"
ADD COLUMN "deletionRequestedAt" TIMESTAMP(3),
ADD COLUMN "deletionScheduledAt" TIMESTAMP(3);

CREATE INDEX "user_deletionScheduledAt_idx" ON "user"("deletionScheduledAt");
