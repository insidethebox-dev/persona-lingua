-- AddForeignKey
ALTER TABLE "learning_materials" ADD CONSTRAINT "learning_materials_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
