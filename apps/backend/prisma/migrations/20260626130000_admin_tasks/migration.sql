-- Admin background task center for long-running content preparation jobs.

CREATE TYPE "AdminTaskStatus" AS ENUM ('queued', 'running', 'completed', 'failed', 'canceled');
CREATE TYPE "AdminTaskLogLevel" AS ENUM ('info', 'warn', 'error');

CREATE TABLE "admin_task" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" "AdminTaskStatus" NOT NULL DEFAULT 'queued',
  "title" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "bullJobId" TEXT,
  "progress" INTEGER NOT NULL DEFAULT 0,
  "currentStep" TEXT,
  "totalItems" INTEGER NOT NULL DEFAULT 0,
  "processedItems" INTEGER NOT NULL DEFAULT 0,
  "successItems" INTEGER NOT NULL DEFAULT 0,
  "failedItems" INTEGER NOT NULL DEFAULT 0,
  "payload" JSONB,
  "summary" JSONB,
  "errorMessage" TEXT,
  "createdById" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "admin_task_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_task_log" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "level" "AdminTaskLogLevel" NOT NULL DEFAULT 'info',
  "step" TEXT,
  "message" TEXT NOT NULL,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "admin_task_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_task_type_status_createdAt_idx" ON "admin_task"("type", "status", "createdAt");
CREATE INDEX "admin_task_targetType_targetId_createdAt_idx" ON "admin_task"("targetType", "targetId", "createdAt");
CREATE INDEX "admin_task_log_taskId_createdAt_idx" ON "admin_task_log"("taskId", "createdAt");

ALTER TABLE "admin_task_log"
  ADD CONSTRAINT "admin_task_log_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "admin_task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
