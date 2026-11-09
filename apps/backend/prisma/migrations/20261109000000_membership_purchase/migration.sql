CREATE TABLE IF NOT EXISTS "membership_purchase" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "rcSubscriptionId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "purchasedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "membership_purchase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "membership_purchase_rcSubscriptionId_key"
  ON "membership_purchase"("rcSubscriptionId");

CREATE INDEX IF NOT EXISTS "membership_purchase_userId_purchasedAt_idx"
  ON "membership_purchase"("userId", "purchasedAt");

ALTER TABLE "membership_purchase"
  DROP CONSTRAINT IF EXISTS "membership_purchase_userId_fkey";

ALTER TABLE "membership_purchase"
  ADD CONSTRAINT "membership_purchase_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "user_membership_rcCustomerId_idx"
  ON "user_membership"("rcCustomerId");
