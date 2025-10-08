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

// Helper function to extract base name without extension
const stripExt = (name: string) => name.replace(/\.[^/.]+$/, "");

async function migratePdfs(limit?: number) {
  console.log(
    `🚀 Starting PDF migration${
      limit ? ` (testing with ${limit} records)` : ""
    }...`
  );

  const pdfs = await prisma.learningMaterial.findMany({
    where: {
      mimeType: "application/pdf",
      // Optional: only migrate files that seem to have the double extension issue
      // fileUrl: { contains: ".pdf.pdf" }
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

      // 1️⃣ Copy existing asset to raw resource type with clean public_id
      console.log(
        `   📤 Copying asset to raw resource type with clean filename...`
      );

      let uploaded: any;
      try {
        // First, get the existing asset details to confirm it exists
        const existingAsset = await cloudinary.api.resource(sourcePublicId, {
          resource_type: "image", // Current files are stored as image type
        });

        console.log(
          `   📄 Found existing asset: ${existingAsset.public_id} (${existingAsset.format})`
        );

        // Use Cloudinary's explicit API to create a raw version from the existing image resource
        console.log(`   � Converting to raw resource type...`);

        uploaded = await cloudinary.uploader.explicit(existingAsset.public_id, {
          resource_type: "image", // Source resource type
          type: "upload",
          eager: [
            {
              resource_type: "raw",
              public_id: `${folder}/${newPublicId}`,
            },
          ],
        });

        // The eager transformation creates the raw version, now get its URL
        if (uploaded.eager && uploaded.eager[0]) {
          uploaded = {
            secure_url: uploaded.eager[0].secure_url,
            public_id: `${folder}/${newPublicId}`,
          };
        } else {
          throw new Error("Failed to create raw version");
        }
      } catch (copyError) {
        console.log(`   ⚠️  Copy method failed: ${copyError}`);
        throw copyError;
      }

      console.log(`   ✅ Upload successful: ${uploaded.secure_url}`);

      // 2️⃣ Update database with new URL and publicId
      console.log(`   💾 Updating database...`);
      await prisma.learningMaterial.update({
        where: { id: item.id },
        data: {
          fileUrl: uploaded.secure_url,
          publicId: newPublicId, // Store without folder prefix
          // Update filename to clean version if needed
          filename: `${cleanBase}.pdf`,
        },
      });

      // 3️⃣ Delete the old asset (with error handling)
      if (item.publicId && item.publicId !== newPublicId) {
        console.log(`   🗑️  Cleaning up old asset: ${item.publicId}`);
        try {
          // Try different resource types as the old files might be stored as different types
          const oldFullPublicId = item.publicId.startsWith(folder)
            ? item.publicId
            : `${folder}/${item.publicId}`;

          // Try deleting as raw first (for PDFs)
          try {
            await cloudinary.api.delete_resources([oldFullPublicId], {
              resource_type: "raw",
            });
            console.log(`   ✅ Deleted old raw asset`);
          } catch {
            // If raw fails, try as image (some old PDFs might be stored as image type)
            try {
              await cloudinary.api.delete_resources([oldFullPublicId], {
                resource_type: "image",
              });
              console.log(`   ✅ Deleted old image asset`);
            } catch (imageError) {
              console.log(
                `   ⚠️  Could not delete old asset (may not exist): ${imageError}`
              );
            }
          }
        } catch (deleteError) {
          console.log(`   ⚠️  Could not delete old asset: ${deleteError}`);
        }
      }

      console.log(`   ✅ Migration complete for: ${item.title}`);
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
    // Test with 2 records first (comment out this line after testing)
    await migratePdfs(2);

    // Uncomment this line after testing to run on all records
    // await migratePdfs();
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

export { migratePdfs };
