-- Store the dynamic Pixi map document without introducing new tables.
ALTER TABLE "game_map" ADD COLUMN "editorData" JSONB;
