import { prisma } from "@/lib/prisma";

async function diagnoseDatabaseIssue() {
  console.log("🔍 Diagnosing database issue...");

  try {
    // Check if we can connect to the database
    console.log("📡 Testing database connection...");
    await prisma.$connect();
    console.log("✅ Database connection successful");

    // Check all tables for record counts
    console.log("\n📊 Checking record counts in all tables:");

    const schoolCount = await prisma.school.count();
    console.log(`   Schools: ${schoolCount}`);

    const teacherCount = await prisma.teacher.count();
    console.log(`   Teachers: ${teacherCount}`);

    const studentCount = await prisma.student.count();
    console.log(`   Students: ${studentCount}`);

    const materialCount = await prisma.learningMaterial.count();
    console.log(`   Learning Materials: ${materialCount}`);

    const reportCount = await prisma.studentReport.count();
    console.log(`   Student Reports: ${reportCount}`);

    // If materials table is empty, let's check if there are any records at all
    if (materialCount === 0) {
      console.log("\n⚠️  Learning materials table is empty!");

      // Check if there are any records in the _prisma_migrations table
      try {
        const migrations =
          await prisma.$queryRaw`SELECT * FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5`;
        console.log("\n📝 Recent migrations:");
        console.log(migrations);
      } catch (migrationError) {
        console.log("❌ Could not check migrations:", migrationError);
      }
    }

    // Check database info
    console.log("\n🗄️  Database information:");
    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl) {
      // Don't log the full URL for security, just the type
      const dbType = databaseUrl.startsWith("postgresql://")
        ? "PostgreSQL"
        : databaseUrl.startsWith("mysql://")
        ? "MySQL"
        : databaseUrl.startsWith("sqlite:")
        ? "SQLite"
        : "Unknown";
      console.log(`   Database type: ${dbType}`);
      console.log(`   URL starts with: ${databaseUrl.substring(0, 20)}...`);
    }
  } catch (error) {
    console.error("❌ Database diagnosis failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Main execution
async function main() {
  try {
    await diagnoseDatabaseIssue();
  } catch (error) {
    console.error("Diagnosis failed:", error);
  }
}

if (require.main === module) {
  main()
    .then(() => {
      console.log("\n🏁 Diagnosis completed.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Diagnosis script failed:", error);
      process.exit(1);
    });
}
