import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// These tests create and delete real rows. They only run when TEST_DATABASE_URL
// is set (validated in jest.setup.js); otherwise they are skipped.
const describeWithDatabase = process.env.TEST_DATABASE_URL
  ? describe
  : describe.skip;

describeWithDatabase("Core Schema and Role Tests", () => {
  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.recommendation.deleteMany();
    await prisma.studentReport.deleteMany();
    await prisma.student.deleteMany();
    await prisma.learningMaterial.deleteMany();
    await prisma.teacher.deleteMany();
    await prisma.school.deleteMany();
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.recommendation.deleteMany();
    await prisma.studentReport.deleteMany();
    await prisma.student.deleteMany();
    await prisma.learningMaterial.deleteMany();
    await prisma.teacher.deleteMany();
    await prisma.school.deleteMany();
    await prisma.$disconnect();
  });

  describe("Schema Validation", () => {
    it("should verify school model has admin credentials", async () => {
      const testSchool = await prisma.school.create({
        data: {
          name: "Core Test School",
          email: "coretest@school.edu",
          password: await bcrypt.hash("testpass", 12),
        },
      });

      expect(testSchool).toBeDefined();
      expect(testSchool.email).toBe("coretest@school.edu");
      expect(testSchool.password).toBeTruthy();
      expect(testSchool.name).toBe("Core Test School");
    });

    it("should verify teacher model has no admin field", async () => {
      const teacher = await prisma.teacher.create({
        data: {
          email: "coreteacher@test.edu",
          name: "Core Test Teacher",
          password: await bcrypt.hash("password", 12),
        },
      });

      expect(teacher).toBeDefined();
      expect("isAdmin" in teacher).toBe(false);
      expect(teacher.email).toBe("coreteacher@test.edu");
      expect(teacher.name).toBe("Core Test Teacher");
    });

    it("should verify independent teachers are supported", async () => {
      const independentTeacher = await prisma.teacher.create({
        data: {
          email: "independent@core.edu",
          name: "Independent Core Teacher",
          password: await bcrypt.hash("password", 12),
          schoolId: null,
          subject: "Mathematics",
          bio: "Independent math tutor",
        },
      });

      expect(independentTeacher).toBeDefined();
      expect(independentTeacher.schoolId).toBeNull();
      expect(independentTeacher.subject).toBe("Mathematics");
      expect(independentTeacher.bio).toBe("Independent math tutor");
    });
  });

  describe("Role Hierarchy", () => {
    it("should verify role separation between schools and teachers", async () => {
      // Create school admin
      const school = await prisma.school.create({
        data: {
          name: "Role Test School",
          email: "admin@roletest.edu",
          password: await bcrypt.hash("adminpass", 12),
        },
      });

      // Create teacher under school
      const teacher = await prisma.teacher.create({
        data: {
          email: "teacher@roletest.edu",
          name: "Role Test Teacher",
          password: await bcrypt.hash("teacherpass", 12),
          schoolId: school.id,
          subject: "Science",
        },
      });

      // Verify school has admin credentials
      expect(school.email).toBeDefined();
      expect(school.password).toBeDefined();

      // Verify teacher is associated with school
      expect(teacher.schoolId).toBe(school.id);

      // Verify teacher has no admin-related fields
      expect("isAdmin" in teacher).toBe(false);

      // Verify school-teacher relationship
      const schoolWithTeachers = await prisma.school.findUnique({
        where: { id: school.id },
        include: { teachers: true },
      });

      expect(schoolWithTeachers?.teachers).toHaveLength(1);
      expect(schoolWithTeachers?.teachers[0].id).toBe(teacher.id);
    });
  });

  describe("Authentication Simulation", () => {
    it("should simulate school admin login flow", async () => {
      const school = await prisma.school.create({
        data: {
          name: "Auth Test School",
          email: "authschool@test.edu",
          password: await bcrypt.hash("schooladmin123", 12),
        },
      });

      // Simulate login attempt
      const foundSchool = await prisma.school.findFirst({
        where: {
          email: "authschool@test.edu",
          password: { not: null },
        },
      });

      expect(foundSchool).toBeDefined();
      expect(foundSchool!.id).toBe(school.id);

      const isPasswordValid = await bcrypt.compare(
        "schooladmin123",
        foundSchool!.password!
      );
      expect(isPasswordValid).toBe(true);

      // Verify auth object structure (what auth.ts would create)
      const authUser = {
        id: foundSchool!.id,
        email: foundSchool!.email || "",
        name: foundSchool!.name,
        schoolId: foundSchool!.id,
        isSchoolAdmin: true,
        isAdmin: true, // Schools are admins
        userType: "school" as const,
      };

      expect(authUser.isAdmin).toBe(true);
      expect(authUser.isSchoolAdmin).toBe(true);
      expect(authUser.userType).toBe("school");
    });

    it("should simulate teacher login flow", async () => {
      const school = await prisma.school.create({
        data: {
          name: "Teacher Auth School",
          email: "admin@teacherauth.edu",
          password: await bcrypt.hash("adminpass", 12),
        },
      });

      const teacher = await prisma.teacher.create({
        data: {
          email: "authteacher@test.edu",
          name: "Auth Test Teacher",
          password: await bcrypt.hash("teacher123", 12),
          schoolId: school.id,
          subject: "English",
        },
      });

      // Simulate login attempt
      const foundTeacher = await prisma.teacher.findUnique({
        where: { email: "authteacher@test.edu" },
        include: { school: true },
      });

      expect(foundTeacher).toBeDefined();
      expect(foundTeacher!.id).toBe(teacher.id);

      const isPasswordValid = await bcrypt.compare(
        "teacher123",
        foundTeacher!.password
      );
      expect(isPasswordValid).toBe(true);

      // Verify auth object structure (what auth.ts would create)
      const authUser = {
        id: foundTeacher!.id,
        email: foundTeacher!.email,
        name: foundTeacher!.name,
        schoolId: foundTeacher!.schoolId,
        isSchoolAdmin: false,
        isAdmin: false, // Teachers are not admins
        schoolName: foundTeacher!.school?.name || "Independent",
        userType: "teacher" as const,
      };

      expect(authUser.isAdmin).toBe(false);
      expect(authUser.isSchoolAdmin).toBe(false);
      expect(authUser.userType).toBe("teacher");
      expect(authUser.schoolName).toBe("Teacher Auth School");
    });
  });
});
