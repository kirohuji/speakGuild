-- RevenueCat subscription event ordering and lifecycle state.
ALTER TABLE "user_membership"
  ADD COLUMN IF NOT EXISTS "lastEventAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "originalTransactionId" TEXT,
  ADD COLUMN IF NOT EXISTS "rcProductId" TEXT,
  ADD COLUMN IF NOT EXISTS "pendingProductId" TEXT,
  ADD COLUMN IF NOT EXISTS "billingIssueAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "revenuecat_webhook_event" (
  "eventId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "eventAt" TIMESTAMP(3) NOT NULL,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "revenuecat_webhook_event_pkey" PRIMARY KEY ("eventId")
);

CREATE INDEX IF NOT EXISTS "revenuecat_webhook_event_userId_eventAt_idx"
  ON "revenuecat_webhook_event"("userId", "eventAt");
