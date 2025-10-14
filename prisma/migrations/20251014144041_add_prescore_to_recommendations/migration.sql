-- AlterTable
ALTER TABLE "recommendations" ADD COLUMN     "preScore" DOUBLE PRECISION,
ADD COLUMN     "scoreRationale" TEXT;

-- AlterTable
ALTER TABLE "students" ALTER COLUMN "language" DROP DEFAULT;
