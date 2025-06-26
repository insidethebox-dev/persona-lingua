import { createMocks } from "node-mocks-http";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { POST } from "@/app/api/schools/route";

const prisma = new PrismaClient();

describe("/api/schools signup endpoint", () => {
  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.teacher.deleteMany();
    await prisma.school.deleteMany();
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.teacher.deleteMany();
    await prisma.school.deleteMany();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up between tests
    await prisma.teacher.deleteMany();
    await prisma.school.deleteMany();
  });

  describe("POST /api/schools", () => {
    it("should create a school admin account successfully", async () => {
      const { req } = createMocks({
        method: "POST",
        body: {
          name: "Test School",
          address: "123 Test Street",
          phone: "+1234567890",
          adminName: "Admin User",
          adminEmail: "admin@testschool.edu",
          adminPassword: "securepassword123",
        },
      });

      const response = await POST(req as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe("School admin account created successfully");
      expect(data.data).toBeDefined();
      expect(data.data.name).toBe("Test School");
      expect(data.data.email).toBe("admin@testschool.edu");

      // Verify the school was created in the database
      const createdSchool = await prisma.school.findUnique({
        where: { email: "admin@testschool.edu" },
      });

      expect(createdSchool).toBeDefined();
      expect(createdSchool!.name).toBe("Test School");
      expect(createdSchool!.address).toBe("123 Test Street");
      expect(createdSchool!.phone).toBe("+1234567890");
      expect(createdSchool!.password).toBeTruthy();

      // Verify password is hashed
      const isPasswordValid = await bcrypt.compare(
        "securepassword123",
        createdSchool!.password!
      );
      expect(isPasswordValid).toBe(true);

      // Verify no teacher admin was created (old behavior)
      const teacherCount = await prisma.teacher.count();
      expect(teacherCount).toBe(0);
    });

    it("should reject signup with missing required fields", async () => {
      const { req } = createMocks({
        method: "POST",
        body: {
          name: "Test School",
          // Missing adminName, adminEmail, adminPassword
        },
      });

      const response = await POST(req as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Missing required fields");
    });

    it("should reject signup with duplicate school name", async () => {
      // Create a school first
      await prisma.school.create({
        data: {
          name: "Existing School",
          email: "existing@school.edu",
          password: await bcrypt.hash("password", 12),
        },
      });

      const { req } = createMocks({
        method: "POST",
        body: {
          name: "Existing School", // Duplicate name
          adminName: "New Admin",
          adminEmail: "newadmin@school.edu",
          adminPassword: "password123",
        },
      });

      const response = await POST(req as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("School with this name already exists");
    });

    it("should reject signup with duplicate email in schools", async () => {
      // Create a school first
      await prisma.school.create({
        data: {
          name: "First School",
          email: "duplicate@email.edu",
          password: await bcrypt.hash("password", 12),
        },
      });

      const { req } = createMocks({
        method: "POST",
        body: {
          name: "Second School",
          adminName: "Admin User",
          adminEmail: "duplicate@email.edu", // Duplicate email
          adminPassword: "password123",
        },
      });

      const response = await POST(req as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Email already exists");
    });

    it("should reject signup with email already used by teacher", async () => {
      // Create a teacher first
      await prisma.teacher.create({
        data: {
          name: "Existing Teacher",
          email: "teacher@email.edu",
          password: await bcrypt.hash("password", 12),
        },
      });

      const { req } = createMocks({
        method: "POST",
        body: {
          name: "New School",
          adminName: "Admin User",
          adminEmail: "teacher@email.edu", // Email already used by teacher
          adminPassword: "password123",
        },
      });

      const response = await POST(req as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Email already exists");
    });

    it("should create school with minimal required data", async () => {
      const { req } = createMocks({
        method: "POST",
        body: {
          name: "Minimal School",
          adminName: "Minimal Admin",
          adminEmail: "minimal@school.edu",
          adminPassword: "password123",
          // No address or phone
        },
      });

      const response = await POST(req as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      const createdSchool = await prisma.school.findUnique({
        where: { email: "minimal@school.edu" },
      });

      expect(createdSchool).toBeDefined();
      expect(createdSchool!.name).toBe("Minimal School");
      expect(createdSchool!.address).toBeNull();
      expect(createdSchool!.phone).toBeNull();
    });

    it("should properly hash passwords", async () => {
      const plainPassword = "mypassword123";

      const { req } = createMocks({
        method: "POST",
        body: {
          name: "Password Test School",
          adminName: "Password Admin",
          adminEmail: "password@test.edu",
          adminPassword: plainPassword,
        },
      });

      await POST(req as any);

      const createdSchool = await prisma.school.findUnique({
        where: { email: "password@test.edu" },
      });

      expect(createdSchool!.password).toBeDefined();
      expect(createdSchool!.password).not.toBe(plainPassword);

      // Verify the password can be verified
      const isValid = await bcrypt.compare(
        plainPassword,
        createdSchool!.password!
      );
      expect(isValid).toBe(true);

      // Verify wrong password fails
      const isInvalid = await bcrypt.compare(
        "wrongpassword",
        createdSchool!.password!
      );
      expect(isInvalid).toBe(false);
    });
  });
});
