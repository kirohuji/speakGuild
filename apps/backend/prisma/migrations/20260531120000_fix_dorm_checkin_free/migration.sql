-- 将「宿舍入住」场景设为免费（修正 seed 中标题不匹配的问题）
UPDATE "scene" SET "isFree" = true WHERE "title" = '宿舍入住' AND "isFree" = false;
