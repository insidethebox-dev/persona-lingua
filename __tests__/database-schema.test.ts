// ⚠️ DANGER: This test file was wiping the entire database!
// ⚠️ It used deleteMany() without WHERE conditions, deleting ALL production data
// ⚠️ DISABLED until it can be safely rewritten to use test database only

/* DISABLED - DO NOT ENABLE WITHOUT FIXING
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

describe("Database Schema Tests", () => {
  const testIds: { [key: string]: string[] } = {
    schools: [],
    teachers: [],
    students: [],
    materials: [],
    reports: [],
    recommendations: []
  };

  beforeAll(async () => {
    // ⚠️ SAFETY: Only clean up records created by tests, not ALL data!
    // We'll track test record IDs instead of using deleteMany() without conditions
    console.log("🧪 Setting up test environment...");
  });

  afterAll(async () => {
    // Clean up ONLY test data by ID
    console.log("🧹 Cleaning up test records...");

    try {
      // Delete test records by their specific IDs
      if (testIds.recommendations.length > 0) {
        await prisma.recommendation.deleteMany({
          where: { id: { in: testIds.recommendations } }
        });
      }
      if (testIds.reports.length > 0) {
        await prisma.studentReport.deleteMany({
          where: { id: { in: testIds.reports } }
        });
      }
      if (testIds.students.length > 0) {
        await prisma.student.deleteMany({
          where: { id: { in: testIds.students } }
        });
      }
      if (testIds.materials.length > 0) {
        await prisma.learningMaterial.deleteMany({
          where: { id: { in: testIds.materials } }
        });
      }
      if (testIds.teachers.length > 0) {
        await prisma.teacher.deleteMany({
          where: { id: { in: testIds.teachers } }
        });
      }
      if (testIds.schools.length > 0) {
        await prisma.school.deleteMany({
          where: { id: { in: testIds.schools } }
        });
      }
    } catch (error) {
      console.error("Error cleaning up test data:", error);
    }

    await prisma.$disconnect();
  });

  describe("School Model", () => {
    it("should create a school with admin credentials", async () => {
      const schoolData = {
        name: "Test School",
        address: "123 Test St",
        phone: "+1234567890",
        email: "admin@testschool.edu",
        password: await bcrypt.hash("testpassword", 12),
        profilePicture: "https://example.com/profile.jpg",
        publicId: "test-profile-id",
      };

      const school = await prisma.school.create({
        data: schoolData,
      });

      // Track test school ID for cleanup
      testIds.schools.push(school.id);

      expect(school).toBeDefined();
      expect(school.id).toBeDefined();
      expect(school.name).toBe(schoolData.name);
      expect(school.email).toBe(schoolData.email);
      expect(school.password).toBeTruthy();
      expect(school.createdAt).toBeDefined();
      expect(school.updatedAt).toBeDefined();

      // Verify password is hashed
      expect(school.password).not.toBe("testpassword");
      const isPasswordValid = await bcrypt.compare(
        "testpassword",
        school.password!
      );
      expect(isPasswordValid).toBe(true);
    });

    it("should enforce unique email constraint for schools", async () => {
      const email = "duplicate@school.edu";

      await prisma.school.create({
        data: {
          name: "First School",
          email,
          password: await bcrypt.hash("password", 12),
        },
      });

      await expect(
        prisma.school.create({
          data: {
            name: "Second School",
            email,
            password: await bcrypt.hash("password", 12),
          },
        })
      ).rejects.toThrow();
    });

    it("should allow schools without passwords (legacy support)", async () => {
      const school = await prisma.school.create({
        data: {
          name: "Legacy School",
          address: "456 Legacy Ave",
          phone: "+0987654321",
          // No email or password - for legacy support
        },
      });

      expect(school).toBeDefined();
      expect(school.email).toBeNull();
      expect(school.password).toBeNull();
    });
  });

  describe("Teacher Model", () => {
    let testSchool: any;

    beforeEach(async () => {
      testSchool = await prisma.school.create({
        data: {
          name: "Teacher Test School",
          email: "admin@teachertest.edu",
          password: await bcrypt.hash("password", 12),
        },
      });
    });

    it("should create a teacher with school association", async () => {
      const teacherData = {
        email: "teacher@teachertest.edu",
        name: "Test Teacher",
        password: await bcrypt.hash("teacherpass", 12),
        schoolId: testSchool.id,
        subject: "Mathematics",
        bio: "Test teacher bio",
        profilePicture: "https://example.com/teacher.jpg",
      };

      const teacher = await prisma.teacher.create({
        data: teacherData,
        include: { school: true },
      });

      expect(teacher).toBeDefined();
      expect(teacher.id).toBeDefined();
      expect(teacher.email).toBe(teacherData.email);
      expect(teacher.name).toBe(teacherData.name);
      expect(teacher.schoolId).toBe(testSchool.id);
      expect(teacher.subject).toBe(teacherData.subject);
      expect(teacher.bio).toBe(teacherData.bio);
      expect(teacher.school?.name).toBe(testSchool.name);
      expect(teacher.createdAt).toBeDefined();
      expect(teacher.updatedAt).toBeDefined();

      // Verify password is hashed
      const isPasswordValid = await bcrypt.compare(
        "teacherpass",
        teacher.password
      );
      expect(isPasswordValid).toBe(true);
    });

    it("should create an independent teacher (no school)", async () => {
      const teacherData = {
        email: "independent@teacher.com",
        name: "Independent Teacher",
        password: await bcrypt.hash("indypass", 12),
        schoolId: null,
        subject: "English",
        bio: "Independent tutor",
      };

      const teacher = await prisma.teacher.create({
        data: teacherData,
      });

      expect(teacher).toBeDefined();
      expect(teacher.schoolId).toBeNull();
      expect(teacher.subject).toBe("English");
      expect(teacher.bio).toBe("Independent tutor");
    });

    it("should enforce unique email constraint for teachers", async () => {
      const email = "duplicate@teacher.com";

      await prisma.teacher.create({
        data: {
          email,
          name: "First Teacher",
          password: await bcrypt.hash("password", 12),
          schoolId: testSchool.id,
        },
      });

      await expect(
        prisma.teacher.create({
          data: {
            email,
            name: "Second Teacher",
            password: await bcrypt.hash("password", 12),
            schoolId: testSchool.id,
          },
        })
      ).rejects.toThrow();
    });

    it("should handle school deletion gracefully (SetNull)", async () => {
      // Create teacher with school
      const teacher = await prisma.teacher.create({
        data: {
          email: "orphan@teacher.com",
          name: "Orphan Teacher",
          password: await bcrypt.hash("password", 12),
          schoolId: testSchool.id,
        },
      });

      expect(teacher.schoolId).toBe(testSchool.id);

      // Delete the school
      await prisma.school.delete({
        where: { id: testSchool.id },
      });

      // Teacher should still exist but with null schoolId
      const updatedTeacher = await prisma.teacher.findUnique({
        where: { id: teacher.id },
      });

      expect(updatedTeacher).toBeDefined();
      expect(updatedTeacher?.schoolId).toBeNull();
    });
  });

  describe("Student and Reports Model", () => {
    let testTeacher: any;

    beforeEach(async () => {
      const school = await prisma.school.create({
        data: {
          name: "Student Test School",
          email: "admin@studenttest.edu",
          password: await bcrypt.hash("password", 12),
        },
      });

      testTeacher = await prisma.teacher.create({
        data: {
          email: "teacher@studenttest.edu",
          name: "Student Test Teacher",
          password: await bcrypt.hash("password", 12),
          schoolId: school.id,
        },
      });
    });

    it("should create students with proper relationships", async () => {
      const student = await prisma.student.create({
        data: {
          name: "Test Student",
          age: 12,
          grade: "7th Grade",
          notes: "Test notes",
          teacherId: testTeacher.id,
        },
        include: { teacher: true },
      });

      expect(student).toBeDefined();
      expect(student.teacher.id).toBe(testTeacher.id);
      expect(student.age).toBe(12);
      expect(student.grade).toBe("7th Grade");
    });

    it("should cascade delete students when teacher is deleted", async () => {
      const student = await prisma.student.create({
        data: {
          name: "Cascade Test Student",
          teacherId: testTeacher.id,
        },
      });

      await prisma.teacher.delete({
        where: { id: testTeacher.id },
      });

      const deletedStudent = await prisma.student.findUnique({
        where: { id: student.id },
      });

      expect(deletedStudent).toBeNull();
    });

    it("should create and cascade delete student reports", async () => {
      const student = await prisma.student.create({
        data: {
          name: "Report Test Student",
          teacherId: testTeacher.id,
        },
      });

      const report = await prisma.studentReport.create({
        data: {
          title: "Test Report",
          content: "Test content",
          studentId: student.id,
        },
      });

      expect(report).toBeDefined();

      // Delete student should cascade delete reports
      await prisma.student.delete({
        where: { id: student.id },
      });

      const deletedReport = await prisma.studentReport.findUnique({
        where: { id: report.id },
      });

      expect(deletedReport).toBeNull();
    });
  });

  describe("Learning Materials Model", () => {
    let testSchool: any;

    beforeEach(async () => {
      testSchool = await prisma.school.create({
        data: {
          name: "Material Test School",
          email: "admin@materialtest.edu",
          password: await bcrypt.hash("password", 12),
        },
      });
    });

    it("should create learning materials with proper metadata", async () => {
      const material = await prisma.learningMaterial.create({
        data: {
          title: "Test Material",
          description: "Test description",
          aiSummary: "AI generated summary",
          filename: "test.pdf",
          originalName: "original-test.pdf",
          mimeType: "application/pdf",
          size: 1024,
          fileUrl: "https://cloudinary.com/test.pdf",
          publicId: "material-test-id",
          topic: "Mathematics",
          level: "7th Grade",
          type: "worksheet",
          skill: "algebra",
          tags: ["math", "algebra", "beginner"],
          uploadedBy: "teacher-id",
          schoolId: testSchool.id,
        },
        include: { school: true },
      });

      expect(material).toBeDefined();
      expect(material.title).toBe("Test Material");
      expect(material.tags).toEqual(["math", "algebra", "beginner"]);
      expect(material.school?.id).toBe(testSchool.id);
      expect(material.topic).toBe("Mathematics");
      expect(material.level).toBe("7th Grade");
      expect(material.type).toBe("worksheet");
      expect(material.skill).toBe("algebra");
    });

    it("should support independent teacher materials (no school)", async () => {
      const material = await prisma.learningMaterial.create({
        data: {
          title: "Independent Material",
          filename: "indie.pdf",
          originalName: "independent.pdf",
          mimeType: "application/pdf",
          size: 512,
          topic: "English",
          level: "8th Grade",
          type: "reading",
          skill: "comprehension",
          uploadedBy: "independent-teacher-id",
          schoolId: null, // Independent teacher material
        },
      });

      expect(material).toBeDefined();
      expect(material.schoolId).toBeNull();
    });
  });

  describe("Role and Admin Logic", () => {
    it("should verify that Teacher model has no isAdmin field", async () => {
      const teacher = await prisma.teacher.create({
        data: {
          email: "noadmin@teacher.com",
          name: "No Admin Teacher",
          password: await bcrypt.hash("password", 12),
        },
      });

      // TypeScript should prevent accessing isAdmin property
      // This test verifies the field doesn't exist in the model
      expect("isAdmin" in teacher).toBe(false);
    });

    it("should verify only schools can have admin credentials", async () => {
      const school = await prisma.school.create({
        data: {
          name: "Admin School",
          email: "admin@adminschool.edu",
          password: await bcrypt.hash("adminpass", 12),
        },
      });

      expect(school.email).toBeDefined();
      expect(school.password).toBeDefined();

      // Verify password works for login
      const isPasswordValid = await bcrypt.compare(
        "adminpass",
        school.password!
      );
      expect(isPasswordValid).toBe(true);
    });
  });
});
*/

// Placeholder test to prevent Jest from failing
describe("Database Schema Tests", () => {
  it("should be safely rewritten before enabling", () => {
    expect(true).toBe(true);
  });
});
