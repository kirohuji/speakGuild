ALTER TABLE "game_activity" ALTER COLUMN "minutes" TYPE DOUBLE PRECISION USING "minutes"::double precision;
ALTER TABLE "game_activity" ALTER COLUMN "minutes" SET DEFAULT 0;
