/*
  Warnings:

  - You are about to drop the column `isAdmin` on the `teachers` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[email]` on the table `schools` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `level` to the `learning_materials` table without a default value. This is not possible if the table is not empty.
  - Added the required column `skill` to the `learning_materials` table without a default value. This is not possible if the table is not empty.
  - Added the required column `topic` to the `learning_materials` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `learning_materials` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "teachers" DROP CONSTRAINT "teachers_schoolId_fkey";

-- AlterTable
ALTER TABLE "learning_materials" ADD COLUMN     "aiSummary" TEXT,
ADD COLUMN     "fileUrl" TEXT,
ADD COLUMN     "level" TEXT NOT NULL,
ADD COLUMN     "publicId" TEXT,
ADD COLUMN     "schoolId" TEXT,
ADD COLUMN     "skill" TEXT NOT NULL,
ADD COLUMN     "topic" TEXT NOT NULL,
ADD COLUMN     "type" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "schools" ADD COLUMN     "password" TEXT,
ADD COLUMN     "profilePicture" TEXT,
ADD COLUMN     "publicId" TEXT;

-- AlterTable
ALTER TABLE "teachers" DROP COLUMN "isAdmin",
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "profilePicture" TEXT,
ADD COLUMN     "publicId" TEXT,
ADD COLUMN     "subject" TEXT,
ALTER COLUMN "schoolId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "schools_email_key" ON "schools"("email");

-- AddForeignKey
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_materials" ADD CONSTRAINT "learning_materials_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE;
