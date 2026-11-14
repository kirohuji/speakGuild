ALTER TABLE "user_check_in" ADD COLUMN "isMakeup" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "makeupCost" INTEGER NOT NULL DEFAULT 0;
-- Keep every points consumer from overspending while another transaction is deducting.
ALTER TABLE "user" ADD CONSTRAINT "user_points_nonnegative" CHECK (points >= 0) NOT VALID;
