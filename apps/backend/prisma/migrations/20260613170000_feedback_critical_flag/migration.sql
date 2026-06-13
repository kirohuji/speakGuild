ALTER TABLE "feedback" ADD COLUMN "isCritical" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "feedback_isCritical_status_idx" ON "feedback"("isCritical", "status");
