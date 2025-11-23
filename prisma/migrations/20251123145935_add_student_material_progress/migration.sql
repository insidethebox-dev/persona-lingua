-- CreateTable
CREATE TABLE "student_material_progress" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "learningMaterialId" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_material_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_material_progress_studentId_idx" ON "student_material_progress"("studentId");

-- CreateIndex
CREATE INDEX "student_material_progress_learningMaterialId_idx" ON "student_material_progress"("learningMaterialId");

-- CreateIndex
CREATE UNIQUE INDEX "student_material_progress_studentId_learningMaterialId_key" ON "student_material_progress"("studentId", "learningMaterialId");

-- AddForeignKey
ALTER TABLE "student_material_progress" ADD CONSTRAINT "student_material_progress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_material_progress" ADD CONSTRAINT "student_material_progress_learningMaterialId_fkey" FOREIGN KEY ("learningMaterialId") REFERENCES "learning_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
