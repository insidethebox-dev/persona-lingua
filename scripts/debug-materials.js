// Debug script to check database and file issues
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function debugMaterials() {
  try {
    console.log("🔍 Checking learning materials...");

    const materials = await prisma.learningMaterial.findMany({
      include: {
        teacher: {
          select: {
            name: true,
            email: true,
            schoolId: true,
          },
        },
        school: {
          select: {
            name: true,
          },
        },
      },
      take: 5, // Just check first 5
    });

    console.log(`📊 Found ${materials.length} materials:`);

    materials.forEach((material, index) => {
      console.log(`\n${index + 1}. ${material.title}`);
      console.log(`   Filename: ${material.filename}`);
      console.log(`   Original: ${material.originalName}`);
      console.log(`   MIME Type: ${material.mimeType}`);
      console.log(`   File URL: ${material.fileUrl ? "Present" : "Missing"}`);
      console.log(`   Public ID: ${material.publicId || "Not set"}`);
      console.log(`   School ID: ${material.schoolId || "Not set"}`);
      console.log(`   Teacher: ${material.teacher?.name || "Not linked"}`);
      console.log(`   School: ${material.school?.name || "Not linked"}`);

      if (material.fileUrl) {
        console.log(`   Full URL: ${material.fileUrl.substring(0, 80)}...`);
      }
    });

    // Check for specific issues
    const materialsWithoutFileUrl = materials.filter((m) => !m.fileUrl);
    const materialsWithoutTeacher = materials.filter((m) => !m.teacher);
    const materialsWithoutSchool = materials.filter(
      (m) => !m.school && m.schoolId
    );

    console.log(`\n🚨 Issues found:`);
    console.log(
      `   Materials without file URL: ${materialsWithoutFileUrl.length}`
    );
    console.log(
      `   Materials without teacher link: ${materialsWithoutTeacher.length}`
    );
    console.log(
      `   Materials without school link: ${materialsWithoutSchool.length}`
    );

    // Test a file URL if available
    if (materials.length > 0 && materials[0].fileUrl) {
      console.log("\n🌐 Testing first file URL...");
      try {
        const response = await fetch(materials[0].fileUrl);
        console.log(`   Response status: ${response.status}`);
        console.log(`   Content type: ${response.headers.get("content-type")}`);
        console.log(
          `   Content length: ${response.headers.get("content-length")}`
        );
      } catch (error) {
        console.log(`   Fetch error: ${error.message}`);
      }
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  debugMaterials();
}
