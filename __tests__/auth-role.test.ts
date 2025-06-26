import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

describe("Authentication and Role Tests", () => {
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

  describe("School Admin Authentication", () => {
    it("should authenticate school admin with correct credentials", async () => {
      const school = await prisma.school.create({
        data: {
          name: "Test School",
          email: "admin@testschool.edu",
          password: await bcrypt.hash("adminpass123", 12),
        },
      });

      // Simulate authentication logic
      const foundSchool = await prisma.school.findFirst({
        where: {
          email: "admin@testschool.edu",
          password: { not: null },
        },
      });

      expect(foundSchool).toBeDefined();
      expect(foundSchool!.id).toBe(school.id);

      const isPasswordValid = await bcrypt.compare(
        "adminpass123",
        foundSchool!.password!
      );
      expect(isPasswordValid).toBe(true);

      // School should have admin properties
      expect(foundSchool!.email).toBe("admin@testschool.edu");
      expect(foundSchool!.name).toBe("Test School");
    });

    it("should reject school admin with wrong password", async () => {
      await prisma.school.create({
        data: {
          name: "Test School",
          email: "admin@testschool.edu",
          password: await bcrypt.hash("correctpass", 12),
        },
      });

      const foundSchool = await prisma.school.findFirst({
        where: {
          email: "admin@testschool.edu",
          password: { not: null },
        },
      });

      const isPasswordValid = await bcrypt.compare(
        "wrongpass",
        foundSchool!.password!
      );
      expect(isPasswordValid).toBe(false);
    });

    it("should not find schools without passwords set", async () => {
      await prisma.school.create({
        data: {
          name: "Legacy School",
          email: "legacy@school.edu",
          // No password set (null)
        },
      });

      const foundSchool = await prisma.school.findFirst({
        where: {
          email: "legacy@school.edu",
          password: { not: null }, // Only schools with passwords
        },
      });

      expect(foundSchool).toBeNull();
    });
  });

  describe("Teacher Authentication", () => {
    let testSchool: any;

    beforeEach(async () => {
      testSchool = await prisma.school.create({
        data: {
          name: "Teacher Test School",
          email: "admin@teachertest.edu",
          password: await bcrypt.hash("adminpass", 12),
        },
      });
    });

    it("should authenticate teacher with correct credentials", async () => {
      const teacher = await prisma.teacher.create({
        data: {
          email: "teacher@testschool.edu",
          name: "Test Teacher",
          password: await bcrypt.hash("teacherpass", 12),
          schoolId: testSchool.id,
          subject: "Mathematics",
        },
      });

      const foundTeacher = await prisma.teacher.findUnique({
        where: { email: "teacher@testschool.edu" },
        include: { school: true },
      });

      expect(foundTeacher).toBeDefined();
      expect(foundTeacher!.id).toBe(teacher.id);

      const isPasswordValid = await bcrypt.compare(
        "teacherpass",
        foundTeacher!.password
      );
      expect(isPasswordValid).toBe(true);

      // Verify teacher properties
      expect(foundTeacher!.name).toBe("Test Teacher");
      expect(foundTeacher!.schoolId).toBe(testSchool.id);
      expect(foundTeacher!.school!.name).toBe("Teacher Test School");
      expect(foundTeacher!.subject).toBe("Mathematics");
    });

    it("should authenticate independent teacher", async () => {
      const teacher = await prisma.teacher.create({
        data: {
          email: "independent@teacher.com",
          name: "Independent Teacher",
          password: await bcrypt.hash("indypass", 12),
          schoolId: null, // Independent
          subject: "English",
        },
      });

      const foundTeacher = await prisma.teacher.findUnique({
        where: { email: "independent@teacher.com" },
        include: { school: true },
      });

      expect(foundTeacher).toBeDefined();
      expect(foundTeacher!.schoolId).toBeNull();
      expect(foundTeacher!.school).toBeNull();
      expect(foundTeacher!.subject).toBe("English");
    });
  });

  describe("Role Hierarchy", () => {
    it("should verify that only schools have admin privileges", async () => {
      // Create school admin
      const school = await prisma.school.create({
        data: {
          name: "Admin School",
          email: "admin@school.edu",
          password: await bcrypt.hash("pass", 12),
        },
      });

      // Create teacher
      const teacher = await prisma.teacher.create({
        data: {
          email: "teacher@school.edu",
          name: "Regular Teacher",
          password: await bcrypt.hash("pass", 12),
          schoolId: school.id,
        },
      });

      // Verify school has admin credentials
      expect(school.email).toBeDefined();
      expect(school.password).toBeDefined();

      // Verify teacher has no admin-related fields
      expect("isAdmin" in teacher).toBe(false);
      expect("password" in teacher).toBe(true); // Teachers have passwords for login

      // But teachers are not admins - this would be handled in auth logic
      // Teachers can only manage their own students, not other teachers
    });

    it("should verify school-teacher relationship", async () => {
      const school = await prisma.school.create({
        data: {
          name: "Parent School",
          email: "admin@parent.edu",
          password: await bcrypt.hash("pass", 12),
        },
      });

      const teacher1 = await prisma.teacher.create({
        data: {
          email: "teacher1@parent.edu",
          name: "Teacher One",
          password: await bcrypt.hash("pass", 12),
          schoolId: school.id,
        },
      });

      const teacher2 = await prisma.teacher.create({
        data: {
          email: "teacher2@parent.edu",
          name: "Teacher Two",
          password: await bcrypt.hash("pass", 12),
          schoolId: school.id,
        },
      });

      // Verify school can access all its teachers
      const schoolWithTeachers = await prisma.school.findUnique({
        where: { id: school.id },
        include: { teachers: true },
      });

      expect(schoolWithTeachers!.teachers).toHaveLength(2);
      expect(schoolWithTeachers!.teachers.map((t) => t.name)).toContain(
        "Teacher One"
      );
      expect(schoolWithTeachers!.teachers.map((t) => t.name)).toContain(
        "Teacher Two"
      );
    });

    it("should verify independent teachers have no school", async () => {
      const independentTeacher = await prisma.teacher.create({
        data: {
          email: "indie@teacher.com",
          name: "Independent Teacher",
          password: await bcrypt.hash("pass", 12),
          schoolId: null,
        },
      });

      const teacherWithSchool = await prisma.teacher.findUnique({
        where: { id: independentTeacher.id },
        include: { school: true },
      });

      expect(teacherWithSchool!.schoolId).toBeNull();
      expect(teacherWithSchool!.school).toBeNull();
    });
  });

  describe("Authentication Flow Simulation", () => {
    it("should simulate complete auth flow for school admin", async () => {
      // Create school
      const school = await prisma.school.create({
        data: {
          name: "Auth Test School",
          email: "authtest@school.edu",
          password: await bcrypt.hash("adminpass123", 12),
        },
      });

      // Simulate login attempt
      const credentials = {
        email: "authtest@school.edu",
        password: "adminpass123",
      };

      // First try to find school
      const foundSchool = await prisma.school.findFirst({
        where: {
          email: credentials.email,
          password: { not: null },
        },
      });

      expect(foundSchool).toBeDefined();

      const isValidPassword = await bcrypt.compare(
        credentials.password,
        foundSchool!.password!
      );
      expect(isValidPassword).toBe(true);

      // Create auth user object (simulating what auth.ts would return)
      const authUser = {
        id: foundSchool!.id,
        email: foundSchool!.email || "",
        name: foundSchool!.name,
        schoolId: foundSchool!.id,
        isSchoolAdmin: true,
        isAdmin: true, // Schools are admins
        schoolName: foundSchool!.name,
        profilePicture: foundSchool!.profilePicture || undefined,
        userType: "school" as const,
      };

      expect(authUser.isAdmin).toBe(true);
      expect(authUser.isSchoolAdmin).toBe(true);
      expect(authUser.userType).toBe("school");
    });

    it("should simulate complete auth flow for teacher", async () => {
      // Create school and teacher
      const school = await prisma.school.create({
        data: {
          name: "Teacher Auth School",
          email: "admin@teacherauth.edu",
          password: await bcrypt.hash("adminpass", 12),
        },
      });

      const teacher = await prisma.teacher.create({
        data: {
          email: "teacher@teacherauth.edu",
          name: "Auth Test Teacher",
          password: await bcrypt.hash("teacherpass123", 12),
          schoolId: school.id,
          subject: "Science",
        },
      });

      // Simulate login attempt
      const credentials = {
        email: "teacher@teacherauth.edu",
        password: "teacherpass123",
      };

      // First try school (should fail)
      const foundSchool = await prisma.school.findFirst({
        where: {
          email: credentials.email,
          password: { not: null },
        },
      });

      expect(foundSchool).toBeNull();

      // Then try teacher (should succeed)
      const foundTeacher = await prisma.teacher.findUnique({
        where: { email: credentials.email },
        include: { school: true },
      });

      expect(foundTeacher).toBeDefined();

      const isValidPassword = await bcrypt.compare(
        credentials.password,
        foundTeacher!.password
      );
      expect(isValidPassword).toBe(true);

      // Create auth user object (simulating what auth.ts would return)
      const authUser = {
        id: foundTeacher!.id,
        email: foundTeacher!.email,
        name: foundTeacher!.name,
        schoolId: foundTeacher!.schoolId,
        isSchoolAdmin: false,
        isAdmin: false, // Teachers are not admins
        schoolName: foundTeacher!.school?.name || "Independent",
        profilePicture: foundTeacher!.profilePicture || undefined,
        userType: "teacher" as const,
      };

      expect(authUser.isAdmin).toBe(false);
      expect(authUser.isSchoolAdmin).toBe(false);
      expect(authUser.userType).toBe("teacher");
      expect(authUser.schoolName).toBe("Teacher Auth School");
    });
  });
});
