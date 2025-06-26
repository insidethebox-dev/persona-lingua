/**
 * API Endpoint Test for Signup Process
 * This tests the actual signup API endpoint
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/schools/route";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Mock NextRequest helper
function createMockRequest(body: Record<string, unknown>): NextRequest {
  return {
    json: async () => body,
    method: "POST",
    url: "http://localhost:3000/api/schools",
    headers: new Headers({ "Content-Type": "application/json" }),
  } as NextRequest;
}

async function testSignupAPI() {
  console.log("🔌 Starting Signup API Integration Test");

  try {
    // Clean up any existing test data
    console.log("🧹 Cleaning up existing test data...");
    await prisma.teacher.deleteMany({
      where: {
        email: {
          contains: "apitest",
        },
      },
    });
    await prisma.school.deleteMany({
      where: {
        email: {
          contains: "apitest",
        },
      },
    });

    // Test 1: Successful School Signup
    console.log("\n✅ Test 1: Successful School Signup...");

    const signupData = {
      name: "API Test School",
      address: "123 API Test Street",
      phone: "+1-555-API-TEST",
      adminName: "API Test Admin",
      adminEmail: "admin@apitest.edu",
      adminPassword: "securepass123",
    };

    const signupRequest = createMockRequest(signupData);
    const signupResponse = await POST(signupRequest);
    const signupResult = await signupResponse.json();

    console.log("Signup Response Status:", signupResponse.status);
    console.log("Signup Response:", signupResult);

    if (signupResponse.status !== 200) {
      throw new Error(`Signup failed: ${signupResult.error}`);
    }

    // Verify school was created
    const createdSchool = await prisma.school.findUnique({
      where: { email: "admin@apitest.edu" },
    });

    if (!createdSchool) {
      throw new Error("School was not created in database");
    }

    console.log("✅ School created successfully:", {
      id: createdSchool.id,
      name: createdSchool.name,
      email: createdSchool.email,
    });

    // Test 2: Duplicate School Name
    console.log("\n🔄 Test 2: Testing Duplicate School Name...");

    const duplicateNameRequest = createMockRequest({
      name: "API Test School", // Same name
      adminName: "Different Admin",
      adminEmail: "different@apitest.edu",
      adminPassword: "password123",
    });

    const duplicateNameResponse = await POST(duplicateNameRequest);
    const duplicateNameResult = await duplicateNameResponse.json();

    console.log("Duplicate Name Response:", duplicateNameResult);

    if (
      duplicateNameResponse.status !== 400 ||
      !duplicateNameResult.error.includes("name already exists")
    ) {
      throw new Error("Duplicate name validation failed");
    }

    console.log("✅ Duplicate name correctly prevented");

    // Test 3: Duplicate Email in Schools
    console.log("\n📧 Test 3: Testing Duplicate Email in Schools...");

    const duplicateEmailRequest = createMockRequest({
      name: "Different School",
      adminName: "Different Admin",
      adminEmail: "admin@apitest.edu", // Same email
      adminPassword: "password123",
    });

    const duplicateEmailResponse = await POST(duplicateEmailRequest);
    const duplicateEmailResult = await duplicateEmailResponse.json();

    console.log("Duplicate Email Response:", duplicateEmailResult);

    if (
      duplicateEmailResponse.status !== 400 ||
      !duplicateEmailResult.error.includes("Email already exists")
    ) {
      throw new Error("Duplicate email validation failed");
    }

    console.log("✅ Duplicate email correctly prevented");

    // Test 4: Cross-Table Email Conflict (School vs Teacher)
    console.log("\n🔀 Test 4: Testing Cross-Table Email Conflict...");

    // First create a teacher
    const teacher = await prisma.teacher.create({
      data: {
        email: "teacher@apitest.edu",
        name: "API Test Teacher",
        password: await bcrypt.hash("teacherpass", 12),
      },
    });

    console.log("Created teacher:", teacher.email);

    // Now try to create school with same email
    const conflictRequest = createMockRequest({
      name: "Conflict School",
      adminName: "Conflict Admin",
      adminEmail: "teacher@apitest.edu", // Same as teacher email
      adminPassword: "password123",
    });

    const conflictResponse = await POST(conflictRequest);
    const conflictResult = await conflictResponse.json();

    console.log("Cross-table Conflict Response:", conflictResult);

    if (
      conflictResponse.status !== 400 ||
      !conflictResult.error.includes("Email already exists")
    ) {
      throw new Error("Cross-table email conflict validation failed");
    }

    console.log("✅ Cross-table email conflict correctly prevented");

    // Test 5: Missing Required Fields
    console.log("\n❌ Test 5: Testing Missing Required Fields...");

    const missingFieldsRequest = createMockRequest({
      name: "Incomplete School",
      // Missing adminName, adminEmail, adminPassword
    });

    const missingFieldsResponse = await POST(missingFieldsRequest);
    const missingFieldsResult = await missingFieldsResponse.json();

    console.log("Missing Fields Response:", missingFieldsResult);

    if (
      missingFieldsResponse.status !== 400 ||
      !missingFieldsResult.error.includes("Missing required fields")
    ) {
      throw new Error("Missing fields validation failed");
    }

    console.log("✅ Missing fields correctly prevented");

    // Test 6: Verify Password Hashing
    console.log("\n🔐 Test 6: Testing Password Hashing...");

    const schoolWithPassword = await prisma.school.findUnique({
      where: { email: "admin@apitest.edu" },
    });

    if (!schoolWithPassword?.password) {
      throw new Error("Password not set on school");
    }

    // Verify password is hashed (not plain text)
    if (schoolWithPassword.password === "securepass123") {
      throw new Error("Password is not hashed");
    }

    // Verify password can be validated
    const isPasswordValid = await bcrypt.compare(
      "securepass123",
      schoolWithPassword.password
    );
    if (!isPasswordValid) {
      throw new Error("Password hash validation failed");
    }

    console.log("✅ Password correctly hashed and validated");

    console.log("\n🎉 All API tests completed successfully!");
    console.log("\n📊 API Test Summary:");
    console.log("✅ School signup API works correctly");
    console.log("✅ Duplicate name validation works");
    console.log("✅ Duplicate email validation works");
    console.log("✅ Cross-table email conflict prevention works");
    console.log("✅ Required field validation works");
    console.log("✅ Password hashing works correctly");

    return { success: true, schoolId: createdSchool.id };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("❌ API Test failed:", error);
    return { success: false, error: errorMessage };
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testSignupAPI()
    .then((result) => {
      if (result.success) {
        console.log("\n🏁 API integration test completed successfully!");
        process.exit(0);
      } else {
        console.log("\n💥 API integration test failed!");
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

export { testSignupAPI };
