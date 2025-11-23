-- Add optional fields to teacher_assistants for backward compatibility
ALTER TABLE "teacher_assistants" ADD COLUMN IF NOT EXISTS "threadId" TEXT;
ALTER TABLE "teacher_assistants" ADD COLUMN IF NOT EXISTS "studentId" TEXT;
ALTER TABLE "teacher_assistants" ADD COLUMN IF NOT EXISTS "sessionData" JSONB;
ALTER TABLE "teacher_assistants" ADD COLUMN IF NOT EXISTS "conversationLogs" JSONB[] DEFAULT ARRAY[]::JSONB[];

-- Create index on studentId if it doesn't exist
CREATE INDEX IF NOT EXISTS "teacher_assistants_studentId_idx" ON "teacher_assistants"("studentId");

-- Drop unique constraint on teacherId if it exists (allow multiple old records per teacher)
ALTER TABLE "teacher_assistants" DROP CONSTRAINT IF EXISTS "teacher_assistants_teacherId_key";

-- Create student_threads table if it doesn't exist
CREATE TABLE IF NOT EXISTS "student_threads" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "assistantId" TEXT NOT NULL,
    "sessionData" JSONB,
    "conversationLogs" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_threads_pkey" PRIMARY KEY ("id")
);

-- Create indexes on student_threads if they don't exist
CREATE UNIQUE INDEX IF NOT EXISTS "student_threads_threadId_key" ON "student_threads"("threadId");
CREATE INDEX IF NOT EXISTS "student_threads_studentId_idx" ON "student_threads"("studentId");
CREATE INDEX IF NOT EXISTS "student_threads_teacherId_idx" ON "student_threads"("teacherId");
CREATE INDEX IF NOT EXISTS "student_threads_threadId_idx" ON "student_threads"("threadId");
