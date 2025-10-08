import { prisma } from "@/lib/prisma";

async function testDatabaseConnection() {
  console.log("🔍 Testing database connection and schema...");

  try {
    // Test raw query to see database info
    console.log("📡 Testing raw database access...");

    // Check what tables exist
    const tables = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;

    console.log("\n📊 Available tables:");
    console.log(tables);

    // Check if any data exists in learning materials with raw query
    console.log("\n🔍 Checking for any learning materials (raw query):");
    const rawMaterials = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM "LearningMaterial";
    `;
    console.log("Raw count:", rawMaterials);

    // Test creating a simple record to verify write access
    console.log("\n✏️  Testing write access...");
    const testSchool = await prisma.school.create({
      data: {
        name: "TEST_SCHOOL_DELETE_ME",
        email: "test@example.com",
        password: "test123",
      },
    });
    console.log("✅ Write test successful, created school:", testSchool.id);

    // Clean up test record
    await prisma.school.delete({
      where: { id: testSchool.id },
    });
    console.log("✅ Test cleanup successful");
  } catch (error) {
    console.error("❌ Database test failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  testDatabaseConnection()
    .then(() => {
      console.log("\n🏁 Database test completed.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Database test script failed:", error);
      process.exit(1);
    });
}
