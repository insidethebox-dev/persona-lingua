import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

// ======================================================================
// MOCK SETUP
// ======================================================================

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  authOptions: {},
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    student: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    teacher: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

// Mocked functions types
const mockGetServerSession = getServerSession as jest.MockedFunction<
  typeof getServerSession
>;
const mockStudentFindMany = prisma.student.findMany as jest.MockedFunction<
  typeof prisma.student.findMany
>;
const mockStudentFindUnique = prisma.student.findUnique as jest.MockedFunction<
  typeof prisma.student.findUnique
>;
const mockTeacherFindFirst = prisma.teacher.findFirst as jest.MockedFunction<
  typeof prisma.teacher.findFirst
>;

// Import handlers under test
import { GET as GET_LIST } from "@/app/api/students/route";
import { GET as GET_DETAIL } from "@/app/api/students/[studentId]/route";

// Helper to create requests
const createMockRequest = (url: string) =>
  new NextRequest(url, {
    method: "GET",
  });

describe("School Admin Access Verification", () => {
  const mockSchoolAdminSession = {
    user: {
      id: "school-123", // Using school ID directly as per auth logic
      email: "admin@school.com",
      isSchoolAdmin: true,
    },
  };

  const mockTeacherSession = {
    user: {
      id: "teacher-123",
      email: "teacher@school.com",
      isSchoolAdmin: false,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/students (List)", () => {
    it("should return students from ALL teachers in the school for a School Admin", async () => {
      mockGetServerSession.mockResolvedValue(mockSchoolAdminSession as any);
      mockStudentFindMany.mockResolvedValue([
        { id: "student-1", name: "Alice", teacherId: "teacher-A" },
        { id: "student-2", name: "Bob", teacherId: "teacher-B" },
      ] as any);

      const req = createMockRequest("http://localhost:3000/api/students");
      const res = await GET_LIST();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2);

      // Verify the query structure used specific logic for school admin
      expect(mockStudentFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            teacher: {
              schoolId: "school-123", // Should filter by school ID
            },
          },
        }),
      );
    });

    it("should return ONLY students belonging to the teacher for a regular Teacher", async () => {
      mockGetServerSession.mockResolvedValue(mockTeacherSession as any);
      mockStudentFindMany.mockResolvedValue([
        { id: "student-3", name: "Charlie", teacherId: "teacher-123" },
      ] as any);

      const req = createMockRequest("http://localhost:3000/api/students");
      const res = await GET_LIST();

      expect(mockStudentFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            teacherId: "teacher-123", // Should filter by teacher ID directly
          },
        }),
      );
    });
  });

  describe("GET /api/students/[id] (Detail)", () => {
    const student = {
      id: "student-1",
      name: "Alice",
      teacherId: "teacher-A",
      teacher: { schoolId: "school-123" }, // Student belongs to a teacher in school-123
    };

    it("should ALLOW access if School Admin's school matches student's teacher's school", async () => {
      mockGetServerSession.mockResolvedValue(mockSchoolAdminSession as any);
      // Student exists
      mockStudentFindUnique.mockResolvedValue(student as any);
      // Teacher check succeeds
      mockTeacherFindFirst.mockResolvedValue({ id: "teacher-A" } as any);

      const req = createMockRequest(
        "http://localhost:3000/api/students/student-1",
      );
      const res = await GET_DETAIL(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe("student-1");

      // Verify it checked if the teacher belongs to the admin's school
      expect(mockTeacherFindFirst).toHaveBeenCalledWith({
        where: {
          id: "teacher-A",
          schoolId: "school-123",
        },
      });
    });

    it("should DENY access if School Admin's school DOES NOT match student's teacher's school", async () => {
      mockGetServerSession.mockResolvedValue(mockSchoolAdminSession as any);
      mockStudentFindUnique.mockResolvedValue(student as any);
      // Teacher check fails (teacher not found in this school)
      mockTeacherFindFirst.mockResolvedValue(null);

      const req = createMockRequest(
        "http://localhost:3000/api/students/student-1",
      );
      const res = await GET_DETAIL(req);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toBe("Access denied");
    });
  });
});
