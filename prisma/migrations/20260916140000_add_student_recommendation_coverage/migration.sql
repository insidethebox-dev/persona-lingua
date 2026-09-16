-- Store the library topic-coverage check from the last recommendation run
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "recommendationCoverage" JSONB;
