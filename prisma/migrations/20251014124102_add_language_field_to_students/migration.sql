/*
  Warnings:

  - Added the required column `language` to the `students` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable: Add language column with a default value for existing rows
ALTER TABLE "students" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'English';
