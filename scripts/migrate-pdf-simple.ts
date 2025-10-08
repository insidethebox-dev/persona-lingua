import { prisma } from "@/lib/prisma";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

const folder = process.env.CLOUDINARY_FOLDER || "personalingua";

const slug = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const stripExt = (name: string) => name.replace(/\.[^/.]+$/, "");

async function migratePdfsSimple(limit?: number) {
  console.log(
    `🚀 Starting PDF migration${
      limit ? ` (testing with ${limit} records)` : ""
    }...`
  );

  const pdfs = await prisma.learningMaterial.findMany({
    where: {
      mimeType: "application/pdf",
    },
    ...(limit && { take: limit }),
    orderBy: { createdAt: "desc" },
  });

  console.log(`📋 Found ${pdfs.length} PDF records to process`);

  if (pdfs.length === 0) {
    console.log("No PDFs found to migrate.");
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  for (const [index, item] of pdfs.entries()) {
    console.log(`\n📝 Processing ${index + 1}/${pdfs.length}: ${item.title}`);
    console.log(`   Current URL: ${item.fileUrl}`);
    console.log(`   Current publicId: ${item.publicId}`);

    try {
      // Create clean filename
      const originalBase = stripExt(
        item.originalName || item.filename || item.title || "file"
      );
      const cleanBase = slug(originalBase);
      const timestamp = Date.now();
      const newPublicId = `${timestamp}-${cleanBase}.pdf`;

      console.log(`   New publicId will be: ${newPublicId}`);

      // Get the current publicId (with or without folder prefix)
      const currentPublicId = item.publicId || "";
      const sourcePublicId = currentPublicId.startsWith(folder)
        ? currentPublicId
        : `${folder}/${currentPublicId}`;

      console.log(`   Source publicId: ${sourcePublicId}`);

      // Method: Use Cloudinary's archive functionality to download and re-upload
      console.log(`   📦 Creating archive to download original file...`);

      // Create a temporary archive with just this file
      const archiveResult = await cloudinary.uploader.create_archive({
        resource_type: "image",
        type: "upload",
        public_ids: [sourcePublicId],
        mode: "download",
      });

      console.log(`   📥 Archive created, downloading...`);

      // Download the archive
      const response = await fetch(archiveResult.secure_url);
      if (!response.ok) {
        throw new Error(`Failed to download archive: ${response.status}`);
      }

      // For now, let's just update the database with a corrected URL
      // We'll manually fix the Cloudinary assets
      const correctedUrl = item.fileUrl!.replace(".pdf.pdf", ".pdf");
      const correctedPublicId = item.publicId!.replace(".pdf.pdf", ".pdf");

      console.log(`   💾 Updating database with corrected URL...`);
      await prisma.learningMaterial.update({
        where: { id: item.id },
        data: {
          fileUrl: correctedUrl,
          publicId: correctedPublicId.replace(`${folder}/`, ""),
          filename: `${cleanBase}.pdf`,
        },
      });

      console.log(`   ✅ Database updated for: ${item.title}`);
      successCount++;
    } catch (err) {
      console.error(`   ❌ Failed to migrate ${item.id} (${item.title}):`, err);
      errorCount++;
    }
  }

  console.log(`\n📊 Migration Summary:`);
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${errorCount}`);
  console.log(`   📋 Total processed: ${pdfs.length}`);

  if (limit) {
    console.log(`\n⚠️  This was a test run with ${limit} records.`);
    console.log(
      `   If results look good, run without limit parameter for all records.`
    );
  }
}

// Main execution
async function main() {
  try {
    // Test with 2 records first
    await migratePdfsSimple(2);

    // Uncomment this line after testing to run on all records
    // await migratePdfsSimple();
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run only if this file is executed directly
if (require.main === module) {
  main()
    .then(() => {
      console.log("Migration script completed.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration script failed:", error);
      process.exit(1);
    });
}

export { migratePdfsSimple };
