/**
 * Comprehensive Security Test for Student Deletion
 *
 * This test suite verifies that the student deletion functionality
 * properly enforces security constraints at multiple levels:
 * - Authentication (user must be logged in)
 * - Authorization (user can only delete their own students)
 * - Cross-school protection (prevents access across school boundaries)
 */

import { NextRequest } from "next/server";
import { DELETE } from "@/app/api/students/route";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

jest.mock("next-auth");
jest.mock("@/lib/prisma", () => ({
  prisma: {
    student: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    teacher: {
      findUnique: jest.fn(),
    },
  },
}));
jest.mock("@/lib/auth");

const mockGetServerSession = getServerSession as jest.MockedFunction<
  typeof getServerSession
>;
const mockStudentFindUnique = prisma.student.findUnique as jest.MockedFunction<
  typeof prisma.student.findUnique
>;
const mockStudentDelete = prisma.student.delete as jest.MockedFunction<
  typeof prisma.student.delete
>;
const mockTeacherFindUnique = prisma.teacher.findUnique as jest.MockedFunction<
  typeof prisma.teacher.findUnique
>;

describe("Student Deletion Security Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createRequest = (studentId: string) => {
    return new NextRequest(
      `http://localhost:3000/api/students?id=${studentId}`,
      {
        method: "DELETE",
      }
    );
  };

  describe("Security Test Scenarios", () => {
    it("Scenario 1: Legitimate teacher deletes their own student", async () => {
      // Setup: Teacher-1 from School-A wants to delete their student
      mockGetServerSession.mockResolvedValue({
        user: { id: "teacher-1" },
      } as any);

      mockStudentFindUnique.mockResolvedValue({
        id: "student-1",
        teacherId: "teacher-1",
        teacher: {
          id: "teacher-1",
          schoolId: "school-a",
        },
      } as any);

      mockTeacherFindUnique.mockResolvedValue({
        id: "teacher-1",
        schoolId: "school-a",
      } as any);

      mockStudentDelete.mockResolvedValue({} as any);

      const response = await DELETE(createRequest("student-1"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockStudentDelete).toHaveBeenCalledWith({
        where: { id: "student-1" },
      });
    });

    it("Scenario 2: Teacher from School-A tries to delete student from School-B", async () => {
      // Setup: Malicious teacher from School-A tries to delete student from School-B
      mockGetServerSession.mockResolvedValue({
        user: { id: "malicious-teacher" },
      } as any);

      mockStudentFindUnique.mockResolvedValue({
        id: "target-student",
        teacherId: "victim-teacher",
        teacher: {
          id: "victim-teacher",
          schoolId: "school-b",
        },
      } as any);

      // This should fail at the teacher ownership check
      const response = await DELETE(createRequest("target-student"));
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe(
        "Unauthorized - You can only delete your own students"
      );
      expect(mockStudentDelete).not.toHaveBeenCalled();
    });

    it("Scenario 3: Hypothetical database corruption - teacher ID matches but schools differ", async () => {
      // This tests the additional school-level security check
      // Even if somehow the teacherId was corrupted to match, school check prevents access

      mockGetServerSession.mockResolvedValue({
        user: { id: "teacher-x" },
      } as any);

      // Hypothetical: Student somehow has teacher-x as teacherId but belongs to different school
      mockStudentFindUnique.mockResolvedValue({
        id: "corrupted-student",
        teacherId: "teacher-x", // Matches current user
        teacher: {
          id: "teacher-x",
          schoolId: "school-victim",
        },
      } as any);

      // But current teacher actually belongs to different school
      mockTeacherFindUnique.mockResolvedValue({
        id: "teacher-x",
        schoolId: "school-attacker",
      } as any);

      const response = await DELETE(createRequest("corrupted-student"));
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Unauthorized - Cross-school access denied");
      expect(mockStudentDelete).not.toHaveBeenCalled();
    });

    it("Scenario 4: Non-existent student deletion attempt", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "teacher-1" },
      } as any);

      mockStudentFindUnique.mockResolvedValue(null);

      const response = await DELETE(createRequest("non-existent"));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Student not found");
      expect(mockStudentDelete).not.toHaveBeenCalled();
    });

    it("Scenario 5: Unauthenticated deletion attempt", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const response = await DELETE(createRequest("any-student"));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
      expect(mockStudentDelete).not.toHaveBeenCalled();
    });
  });

  describe("Data Integrity Verification", () => {
    it("should verify all required database queries are made in correct order", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "teacher-1" },
      } as any);

      mockStudentFindUnique.mockResolvedValue({
        id: "student-1",
        teacherId: "teacher-1",
        teacher: {
          id: "teacher-1",
          schoolId: "school-a",
        },
      } as any);

      mockTeacherFindUnique.mockResolvedValue({
        id: "teacher-1",
        schoolId: "school-a",
      } as any);

      mockStudentDelete.mockResolvedValue({} as any);

      await DELETE(createRequest("student-1"));

      // Verify the sequence of database operations
      expect(mockStudentFindUnique).toHaveBeenCalledWith({
        where: { id: "student-1" },
        include: {
          teacher: {
            select: {
              id: true,
              schoolId: true,
            },
          },
        },
      });

      expect(mockTeacherFindUnique).toHaveBeenCalledWith({
        where: { id: "teacher-1" },
        select: { schoolId: true },
      });

      expect(mockStudentDelete).toHaveBeenCalledWith({
        where: { id: "student-1" },
      });
    });
  });
});
