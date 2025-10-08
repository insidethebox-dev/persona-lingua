import { NextRequest } from "next/server";
import { DELETE } from "@/app/api/students/route";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

// Mock the dependencies
jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

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

jest.mock("@/lib/auth", () => ({
  authOptions: {},
}));

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

describe("DELETE /api/students", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockRequest = (studentId?: string) => {
    const url = studentId
      ? `http://localhost:3000/api/students?id=${studentId}`
      : "http://localhost:3000/api/students";

    return new NextRequest(url, {
      method: "DELETE",
    });
  };

  describe("Authentication", () => {
    it("should return 401 if user is not authenticated", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = createMockRequest("student-123");
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("Input Validation", () => {
    it("should return 400 if student ID is missing", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "teacher-123" },
      } as any);

      const request = createMockRequest(); // No student ID
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Student ID is required");
    });
  });

  describe("Student Existence", () => {
    it("should return 404 if student does not exist", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "teacher-123" },
      } as any);

      mockStudentFindUnique.mockResolvedValue(null);

      const request = createMockRequest("nonexistent-student");
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Student not found");
    });
  });

  describe("Authorization - Teacher Ownership", () => {
    it("should return 403 if teacher tries to delete another teacher's student", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "teacher-123" },
      } as any);

      // Mock student belongs to different teacher
      mockStudentFindUnique.mockResolvedValue({
        id: "student-123",
        teacherId: "teacher-456", // Different teacher
        teacher: {
          id: "teacher-456",
          schoolId: "school-1",
        },
      } as any);

      const request = createMockRequest("student-123");
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toBe(
        "Unauthorized - You can only delete your own students"
      );
    });
  });

  describe("Authorization - Cross-School Protection", () => {
    it("should return 403 if teacher tries to delete student from different school", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "teacher-123" },
      } as any);

      // Mock student belongs to current teacher but different school
      mockStudentFindUnique.mockResolvedValue({
        id: "student-123",
        teacherId: "teacher-123", // Same teacher
        teacher: {
          id: "teacher-123",
          schoolId: "school-2", // Different school
        },
      } as any);

      // Mock current teacher belongs to different school
      mockTeacherFindUnique.mockResolvedValue({
        id: "teacher-123",
        schoolId: "school-1", // Different school
      } as any);

      const request = createMockRequest("student-123");
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Unauthorized - Cross-school access denied");
    });
  });

  describe("Successful Deletion", () => {
    it("should successfully delete student when all authorization checks pass", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "teacher-123" },
      } as any);

      // Mock student belongs to current teacher and same school
      mockStudentFindUnique.mockResolvedValue({
        id: "student-123",
        teacherId: "teacher-123",
        teacher: {
          id: "teacher-123",
          schoolId: "school-1",
        },
      } as any);

      // Mock current teacher belongs to same school
      mockTeacherFindUnique.mockResolvedValue({
        id: "teacher-123",
        schoolId: "school-1",
      } as any);

      // Mock successful deletion
      mockStudentDelete.mockResolvedValue({} as any);

      const request = createMockRequest("student-123");
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe("Student deleted successfully");
      expect(mockStudentDelete).toHaveBeenCalledWith({
        where: { id: "student-123" },
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors gracefully", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "teacher-123" },
      } as any);

      // Mock database error
      mockStudentFindUnique.mockRejectedValue(
        new Error("Database connection failed")
      );

      const request = createMockRequest("student-123");
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Internal server error");
    });
  });

  describe("Security Scenarios", () => {
    it("should prevent teacher from different school deleting student even with correct teacher ID", async () => {
      // This test ensures that even if someone manipulates the teacherId in the database,
      // the cross-school check still prevents unauthorized access

      mockGetServerSession.mockResolvedValue({
        user: { id: "malicious-teacher" },
      } as any);

      // Mock student that somehow has the malicious teacher's ID but belongs to different school
      mockStudentFindUnique.mockResolvedValue({
        id: "student-123",
        teacherId: "malicious-teacher",
        teacher: {
          id: "malicious-teacher",
          schoolId: "school-2",
        },
      } as any);

      // Mock malicious teacher belongs to different school
      mockTeacherFindUnique.mockResolvedValue({
        id: "malicious-teacher",
        schoolId: "school-1", // Different school
      } as any);

      const request = createMockRequest("student-123");
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Unauthorized - Cross-school access denied");
    });

    it("should handle case where teacher record is missing", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "teacher-123" },
      } as any);

      mockStudentFindUnique.mockResolvedValue({
        id: "student-123",
        teacherId: "teacher-123",
        teacher: {
          id: "teacher-123",
          schoolId: "school-1",
        },
      } as any);

      // Mock teacher not found
      mockTeacherFindUnique.mockResolvedValue(null);

      const request = createMockRequest("student-123");
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Unauthorized - Cross-school access denied");
    });
  });
});
