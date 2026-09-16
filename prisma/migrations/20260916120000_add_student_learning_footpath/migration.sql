-- Add AI-generated lesson footpath to students
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "learningFootpath" JSONB;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "footpathGeneratedAt" TIMESTAMP(3);
