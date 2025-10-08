import { prisma } from "@/lib/prisma";

async function testSchoolIsolation() {
  console.log("🔍 Testing school-based material isolation...");

  try {
    // Get all schools
    const schools = await prisma.school.findMany({
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            teachers: true,
            learningMaterials: true,
          },
        },
      },
    });

    console.log(`\n📊 Found ${schools.length} schools:`);
    schools.forEach((school) => {
      console.log(`   🏫 ${school.name}:`);
      console.log(`      - Teachers: ${school._count.teachers}`);
      console.log(`      - Materials: ${school._count.learningMaterials}`);
    });

    // Test material filtering for each school
    for (const school of schools) {
      console.log(`\n🔍 Testing materials for school: ${school.name}`);

      const materials = await prisma.learningMaterial.findMany({
        where: {
          schoolId: school.id,
        },
        include: {
          teacher: {
            select: {
              name: true,
              schoolId: true,
            },
          },
        },
      });

      console.log(`   📚 Found ${materials.length} materials`);

      // Verify all materials belong to teachers from the same school
      const validMaterials = materials.filter(
        (material) => material.teacher?.schoolId === school.id
      );

      if (validMaterials.length === materials.length) {
        console.log(`   ✅ All materials correctly isolated to school`);
      } else {
        console.log(
          `   ⚠️  ${
            materials.length - validMaterials.length
          } materials have wrong school association`
        );
      }
    }

    // Test teacher-material relationship
    console.log(`\n🔍 Testing teacher-material relationships...`);
    const teachers = await prisma.teacher.findMany({
      include: {
        _count: {
          select: {
            learningMaterials: true,
          },
        },
        school: {
          select: {
            name: true,
          },
        },
      },
    });

    teachers.forEach((teacher) => {
      if (teacher._count.learningMaterials > 0) {
        console.log(
          `   👨‍🏫 ${teacher.name} (${teacher.school?.name}): ${teacher._count.learningMaterials} materials`
        );
      }
    });
  } catch (error) {
    console.error("❌ Error testing school isolation:", error);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  testSchoolIsolation()
    .then(() => {
      console.log("\n🏁 School isolation test completed.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("School isolation test failed:", error);
      process.exit(1);
    });
}

export { testSchoolIsolation };
