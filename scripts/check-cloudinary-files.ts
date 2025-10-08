import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

const folder = process.env.CLOUDINARY_FOLDER || "personalingua";

async function checkCloudinaryFiles() {
  console.log("🔍 Checking Cloudinary for existing files...");

  try {
    // Get all files in the folder
    const result = await cloudinary.api.resources({
      type: "upload",
      resource_type: "auto",
      prefix: folder,
      max_results: 50,
    });

    console.log(`📊 Found ${result.resources.length} files in Cloudinary:`);

    result.resources.forEach((resource: unknown, index: number) => {
      const r = resource as {
        public_id: string;
        format: string;
        bytes: number;
        secure_url: string;
        created_at: string;
      };
      console.log(`${index + 1}. ${r.public_id}`);
      console.log(`   Format: ${r.format}`);
      console.log(`   Size: ${Math.round(r.bytes / 1024)}KB`);
      console.log(`   URL: ${r.secure_url}`);
      console.log(`   Created: ${new Date(r.created_at).toLocaleDateString()}`);
      console.log("");
    });

    // Also check raw resources (PDFs)
    const rawResult = await cloudinary.api.resources({
      type: "upload",
      resource_type: "raw",
      prefix: folder,
      max_results: 50,
    });

    if (rawResult.resources.length > 0) {
      console.log(
        `📊 Found ${rawResult.resources.length} raw files (PDFs, docs) in Cloudinary:`
      );

      rawResult.resources.forEach((resource: unknown, index: number) => {
        const r = resource as {
          public_id: string;
          format: string;
          bytes: number;
          secure_url: string;
          created_at: string;
        };
        console.log(`${index + 1}. ${r.public_id}`);
        console.log(`   Format: ${r.format}`);
        console.log(`   Size: ${Math.round(r.bytes / 1024)}KB`);
        console.log(`   URL: ${r.secure_url}`);
        console.log(
          `   Created: ${new Date(r.created_at).toLocaleDateString()}`
        );
        console.log("");
      });
    }
  } catch (error) {
    console.error("❌ Error checking Cloudinary:", error);
  }
}

if (require.main === module) {
  checkCloudinaryFiles()
    .then(() => {
      console.log("🏁 Cloudinary check completed.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Cloudinary check failed:", error);
      process.exit(1);
    });
}
