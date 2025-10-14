/*
  Warnings:

  - Added the required column `language` to the `learning_materials` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable: Add language column with a default value for existing rows
ALTER TABLE "learning_materials" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'English';

-- Update the default constraint to remove the default for future inserts (optional)
-- ALTER TABLE "learning_materials" ALTER COLUMN "language" DROP DEFAULT;
