import { prisma } from "@/lib/prisma";

async function fixDatabaseUrls() {
  console.log("🚀 Starting database URL cleanup...");

  // Find all files with extra .pdf extensions (regardless of original file type)
  const filesWithExtraPdf = await prisma.learningMaterial.findMany({
    where: {
      OR: [
        { fileUrl: { contains: ".pdf.pdf" } }, // PDF files with double extension
        { fileUrl: { contains: ".doc.pdf" } }, // DOC files with .pdf added
        { fileUrl: { contains: ".docx.pdf" } }, // DOCX files with .pdf added
        { fileUrl: { contains: ".txt.pdf" } }, // TXT files with .pdf added
        { fileUrl: { contains: ".rtf.pdf" } }, // RTF files with .pdf added
        { fileUrl: { contains: ".jpg.pdf" } }, // JPG files with .pdf added
        { fileUrl: { contains: ".jpeg.pdf" } }, // JPEG files with .pdf added
        { fileUrl: { contains: ".png.pdf" } }, // PNG files with .pdf added
        { fileUrl: { contains: ".gif.pdf" } }, // GIF files with .pdf added
        { fileUrl: { contains: ".bmp.pdf" } }, // BMP files with .pdf added
        { fileUrl: { contains: ".tiff.pdf" } }, // TIFF files with .pdf added
        { fileUrl: { contains: ".svg.pdf" } }, // SVG files with .pdf added
        { fileUrl: { contains: ".ppt.pdf" } }, // PPT files with .pdf added
        { fileUrl: { contains: ".pptx.pdf" } }, // PPTX files with .pdf added
        { fileUrl: { contains: ".xls.pdf" } }, // XLS files with .pdf added
        { fileUrl: { contains: ".xlsx.pdf" } }, // XLSX files with .pdf added
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(
    `📋 Found ${filesWithExtraPdf.length} files with extra .pdf extensions`
  );

  let successCount = 0;
  let errorCount = 0;

  for (const [index, item] of filesWithExtraPdf.entries()) {
    console.log(
      `\n📝 Processing ${index + 1}/${filesWithExtraPdf.length}: ${item.title}`
    );
    console.log(`   Current URL: ${item.fileUrl}`);
    console.log(`   Current publicId: ${item.publicId}`);

    try {
      // Function to remove extra .pdf extension from various file types
      const removeExtraPdf = (str: string) => {
        const patterns = [
          ".pdf.pdf",
          ".doc.pdf",
          ".docx.pdf",
          ".txt.pdf",
          ".rtf.pdf",
          ".jpg.pdf",
          ".jpeg.pdf",
          ".png.pdf",
          ".gif.pdf",
          ".bmp.pdf",
          ".tiff.pdf",
          ".svg.pdf",
          ".ppt.pdf",
          ".pptx.pdf",
          ".xls.pdf",
          ".xlsx.pdf",
        ];

        for (const pattern of patterns) {
          if (str.includes(pattern)) {
            return str.replace(pattern, pattern.replace(".pdf", ""));
          }
        }
        return str;
      };

      // Fix the URLs by removing the extra .pdf extension
      const correctedUrl = removeExtraPdf(item.fileUrl!);
      const correctedPublicId = removeExtraPdf(item.publicId!).replace(
        "personalingua/",
        ""
      );
      const correctedFilename = removeExtraPdf(item.filename!);

      // Determine what type of correction was made
      const originalExt = item.fileUrl!.includes(".pdf.pdf")
        ? ".pdf.pdf"
        : item.fileUrl!.includes(".doc.pdf")
        ? ".doc.pdf"
        : item.fileUrl!.includes(".docx.pdf")
        ? ".docx.pdf"
        : item.fileUrl!.includes(".txt.pdf")
        ? ".txt.pdf"
        : item.fileUrl!.includes(".rtf.pdf")
        ? ".rtf.pdf"
        : item.fileUrl!.includes(".jpg.pdf")
        ? ".jpg.pdf"
        : item.fileUrl!.includes(".jpeg.pdf")
        ? ".jpeg.pdf"
        : item.fileUrl!.includes(".png.pdf")
        ? ".png.pdf"
        : item.fileUrl!.includes(".gif.pdf")
        ? ".gif.pdf"
        : item.fileUrl!.includes(".bmp.pdf")
        ? ".bmp.pdf"
        : item.fileUrl!.includes(".tiff.pdf")
        ? ".tiff.pdf"
        : item.fileUrl!.includes(".svg.pdf")
        ? ".svg.pdf"
        : item.fileUrl!.includes(".ppt.pdf")
        ? ".ppt.pdf"
        : item.fileUrl!.includes(".pptx.pdf")
        ? ".pptx.pdf"
        : item.fileUrl!.includes(".xls.pdf")
        ? ".xls.pdf"
        : item.fileUrl!.includes(".xlsx.pdf")
        ? ".xlsx.pdf"
        : "unknown";

      console.log(`   🔧 Removing extra .pdf from ${originalExt} extension`);
      console.log(`   ✅ Corrected URL: ${correctedUrl}`);
      console.log(`   ✅ Corrected publicId: ${correctedPublicId}`);

      await prisma.learningMaterial.update({
        where: { id: item.id },
        data: {
          fileUrl: correctedUrl,
          publicId: correctedPublicId,
          filename: correctedFilename,
        },
      });

      console.log(`   ✅ Database updated successfully`);
      successCount++;
    } catch (err) {
      console.error(`   ❌ Failed to update ${item.id}:`, err);
      errorCount++;
    }
  }

  console.log(`\n📊 Database Update Summary:`);
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${errorCount}`);
  console.log(`   📋 Total processed: ${filesWithExtraPdf.length}`);
}

// Main execution
async function main() {
  try {
    await fixDatabaseUrls();
  } catch (error) {
    console.error("Database fix failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main()
    .then(() => {
      console.log("Database URL cleanup completed.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Database URL cleanup failed:", error);
      process.exit(1);
    });
}
