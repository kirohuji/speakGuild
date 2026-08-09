-- AlterTable
ALTER TABLE "scene" ADD COLUMN "groupId" TEXT,
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "scene_groupId_sortOrder_idx" ON "scene"("groupId", "sortOrder");

-- CreateTable
CREATE TABLE "scene_material_reference" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "materialType" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "topicId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'learn',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "scene_material_reference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scene_material_reference_sceneId_materialType_materialId_key" ON "scene_material_reference"("sceneId", "materialType", "materialId");

-- CreateIndex
CREATE INDEX "scene_material_reference_materialType_materialId_idx" ON "scene_material_reference"("materialType", "materialId");

-- CreateIndex
CREATE INDEX "scene_material_reference_sceneId_topicId_idx" ON "scene_material_reference"("sceneId", "topicId");

-- AddForeignKey
ALTER TABLE "scene" ADD CONSTRAINT "scene_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "package_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_material_reference" ADD CONSTRAINT "scene_material_reference_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: 把现有 PackageGroupItem 的组与顺序迁移到 Scene.groupId / Scene.sortOrder
UPDATE "scene" SET "groupId" = pgi."groupId", "sortOrder" = pgi."sortOrder"
FROM "package_group_item" pgi
WHERE pgi."sceneId" = "scene"."id";
