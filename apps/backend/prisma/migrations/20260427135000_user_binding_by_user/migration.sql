-- AlterTable
ALTER TABLE "user_binding_config"
ADD COLUMN "userId" TEXT,
ALTER COLUMN "deviceId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "user_binding_config_userId_key" ON "user_binding_config"("userId");

-- AddForeignKey
ALTER TABLE "user_binding_config"
ADD CONSTRAINT "user_binding_config_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
