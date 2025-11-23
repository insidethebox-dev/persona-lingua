-- CreateTable
CREATE TABLE "teacher_assistants" (
    "id" TEXT NOT NULL,
    "assistantId" TEXT NOT NULL,
    "threadId" TEXT,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "sessionData" JSONB,
    "conversationLogs" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_assistants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teacher_assistants_assistantId_key" ON "teacher_assistants"("assistantId");

-- CreateIndex
CREATE INDEX "teacher_assistants_studentId_idx" ON "teacher_assistants"("studentId");

-- CreateIndex
CREATE INDEX "teacher_assistants_teacherId_idx" ON "teacher_assistants"("teacherId");

-- CreateIndex
CREATE INDEX "teacher_assistants_assistantId_idx" ON "teacher_assistants"("assistantId");
