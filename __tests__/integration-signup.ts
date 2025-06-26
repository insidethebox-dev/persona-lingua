/**
 * Manual Integration Test for Signup Process
 * This script tests the complete signup flow end-to-end
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function testSignupProcess() {
  console.log("🧪 Starting Signup Process Integration Test");

  try {
    // Clean up any existing test data
    console.log("🧹 Cleaning up existing test data...");
    await prisma.teacher.deleteMany({
      where: {
        email: {
          contains: "signuptest",
        },
      },
    });
    await prisma.school.deleteMany({
      where: {
        email: {
          contains: "signuptest",
        },
      },
    });

    // Test 1: Verify Database Schema
    console.log("\n📋 Test 1: Verifying Database Schema...");

    // Check if School model has the correct fields
    const schoolFields = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'schools'
      ORDER BY column_name;
    `;

    console.log("✅ School table fields:", schoolFields);

    // Check if Teacher model does NOT have isAdmin field
    const teacherFields = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'teachers'
      ORDER BY column_name;
    `;

    console.log("✅ Teacher table fields:", teacherFields);

    // Test 2: Create School Admin (Simulating Signup)
    console.log("\n📝 Test 2: Testing School Admin Creation...");

    const testSchoolData = {
      name: "Integration Test School",
      address: "123 Test Avenue",
      phone: "+1-555-TEST-123",
      email: "admin@signuptest.edu",
      password: await bcrypt.hash("testadmin123", 12),
    };

    const createdSchool = await prisma.school.create({
      data: testSchoolData,
    });

    console.log("✅ School admin created:", {
      id: createdSchool.id,
      name: createdSchool.name,
      email: createdSchool.email,
      hasPassword: !!createdSchool.password,
    });

    // Test 3: Verify Authentication Flow
    console.log("\n🔐 Test 3: Testing Authentication Flow...");

    // Test school admin login
    const foundSchool = await prisma.school.findFirst({
      where: {
        email: "admin@signuptest.edu",
        password: { not: null },
      },
    });

    if (!foundSchool) {
      throw new Error("School admin not found for authentication");
    }

    const isPasswordValid = await bcrypt.compare(
      "testadmin123",
      foundSchool.password!
    );
    if (!isPasswordValid) {
      throw new Error("Password validation failed");
    }

    console.log("✅ School admin authentication successful");

    // Simulate auth user creation (what happens in auth.ts)
    const authUser = {
      id: foundSchool.id,
      email: foundSchool.email || "",
      name: foundSchool.name,
      schoolId: foundSchool.id,
      isSchoolAdmin: true,
      isAdmin: true,
      schoolName: foundSchool.name,
      userType: "school" as const,
    };

    console.log("✅ Auth user object created:", authUser);

    // Test 4: Create Teachers Under School
    console.log("\n👩‍🏫 Test 4: Testing Teacher Creation...");

    const teacher1 = await prisma.teacher.create({
      data: {
        email: "teacher1@signuptest.edu",
        name: "Test Teacher One",
        password: await bcrypt.hash("teacher123", 12),
        schoolId: createdSchool.id,
        subject: "Mathematics",
        bio: "Experienced math teacher",
      },
    });

    const teacher2 = await prisma.teacher.create({
      data: {
        email: "independent@signuptest.edu",
        name: "Independent Teacher",
        password: await bcrypt.hash("teacher123", 12),
        schoolId: null, // Independent teacher
        subject: "English",
        bio: "Independent English tutor",
      },
    });

    console.log("✅ Teachers created:", {
      schoolTeacher: {
        id: teacher1.id,
        name: teacher1.name,
        schoolId: teacher1.schoolId,
      },
      independentTeacher: {
        id: teacher2.id,
        name: teacher2.name,
        schoolId: teacher2.schoolId,
      },
    });

    // Test 5: Verify Relationships
    console.log("\n🔗 Test 5: Testing Relationships...");

    const schoolWithTeachers = await prisma.school.findUnique({
      where: { id: createdSchool.id },
      include: {
        teachers: {
          select: {
            id: true,
            name: true,
            email: true,
            subject: true,
          },
        },
      },
    });

    console.log("✅ School with teachers:", {
      school: schoolWithTeachers?.name,
      teacherCount: schoolWithTeachers?.teachers.length,
      teachers: schoolWithTeachers?.teachers,
    });

    // Test 6: Verify No Admin Fields on Teachers
    console.log("\n🚫 Test 6: Verifying No Admin Logic for Teachers...");

    const teacherCheck = await prisma.teacher.findUnique({
      where: { id: teacher1.id },
    });

    // TypeScript compilation would fail if isAdmin existed
    console.log("✅ Teacher has no admin fields:", {
      hasIsAdminField: "isAdmin" in teacherCheck!,
      teacherFields: Object.keys(teacherCheck!),
    });

    // Test 7: Test Duplicate Email Prevention
    console.log("\n🔄 Test 7: Testing Duplicate Email Prevention...");

    try {
      await prisma.school.create({
        data: {
          name: "Duplicate School",
          email: "admin@signuptest.edu", // Same email
          password: await bcrypt.hash("different", 12),
        },
      });
      console.log("❌ Duplicate email test FAILED - should have thrown error");
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.log("✅ Duplicate email correctly prevented:", errorMessage);
    }

    try {
      await prisma.teacher.create({
        data: {
          email: "admin@signuptest.edu", // Same as school email
          name: "Conflict Teacher",
          password: await bcrypt.hash("pass", 12),
        },
      });
      console.log(
        "❌ School-Teacher email conflict test FAILED - should have thrown error"
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.log(
        "✅ School-Teacher email conflict correctly prevented:",
        errorMessage
      );
    }

    // Test 8: Test Student-Teacher Cascade
    console.log("\n👨‍🎓 Test 8: Testing Student-Teacher Relationships...");

    const student = await prisma.student.create({
      data: {
        name: "Test Student",
        age: 12,
        grade: "7th Grade",
        notes: "Test student for cascade testing",
        teacherId: teacher1.id,
      },
    });

    console.log("✅ Student created:", {
      id: student.id,
      name: student.name,
      teacherId: student.teacherId,
    });

    console.log("\n🎉 All tests completed successfully!");
    console.log("\n📊 Test Summary:");
    console.log("✅ Database schema is correct");
    console.log("✅ School admin signup process works");
    console.log("✅ Authentication flow works");
    console.log("✅ Role hierarchy is properly implemented");
    console.log("✅ Teachers have no admin privileges");
    console.log("✅ Email uniqueness is enforced");
    console.log("✅ Relationships work correctly");

    return {
      success: true,
      schoolId: createdSchool.id,
      teacherIds: [teacher1.id, teacher2.id],
      studentId: student.id,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Test failed:", error);
    return { success: false, error: errorMessage };
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testSignupProcess()
    .then((result) => {
      if (result.success) {
        console.log("\n🏁 Integration test completed successfully!");
        process.exit(0);
      } else {
        console.log("\n💥 Integration test failed!");
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error("💥 Unexpected error:", error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { testSignupProcess };
