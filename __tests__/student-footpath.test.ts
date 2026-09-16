import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { generateLearningFootpath } from "@/lib/openai";

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  authOptions: {},
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    teacher: { findUnique: jest.fn() },
    student: { findFirst: jest.fn(), update: jest.fn() },
  },
}));

jest.mock("@/lib/openai", () => ({
  generateLearningFootpath: jest.fn(),
}));

const mockGetServerSession = getServerSession as jest.MockedFunction<
  typeof getServerSession
>;
const mockTeacherFindUnique = prisma.teacher.findUnique as jest.MockedFunction<
  typeof prisma.teacher.findUnique
>;
const mockStudentFindFirst = prisma.student.findFirst as jest.MockedFunction<
  typeof prisma.student.findFirst
>;
const mockStudentUpdate = prisma.student.update as jest.MockedFunction<
  typeof prisma.student.update
>;
const mockGenerateFootpath = generateLearningFootpath as jest.MockedFunction<
  typeof generateLearningFootpath
>;

import { POST } from "@/app/api/students/[studentId]/footpath/route";

const FOOTPATH = {
  summary: "Curious learner who tires quickly with long texts.",
  teachingApproach: "Short, varied tasks with frequent oral feedback.",
  stages: [
    {
      title: "Rebuild confidence",
      goal: "Read short passages aloud fluently",
      focusAreas: ["Reading", "Pronunciation"],
      activities: ["Paired reading", "Echo reading"],
      successIndicators: ["Reads a 100-word passage without stopping"],
      estimatedDuration: "2 weeks",
    },
  ],
  accommodations: ["Larger font, cream background"],
  motivationTips: ["Use football-themed texts"],
  watchOuts: ["Avoidance of reading tasks signals fatigue"],
};

describe("POST /api/students/[studentId]/footpath", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const request = (studentId = "student-1") =>
    new NextRequest(
      `http://localhost:3000/api/students/${studentId}/footpath`,
      { method: "POST" },
    );

  const authenticateTeacher = () => {
    mockGetServerSession.mockResolvedValue({
      user: { email: "teacher@school.com" },
    } as any);
    mockTeacherFindUnique.mockResolvedValue({
      id: "teacher-1",
      email: "teacher@school.com",
    } as any);
  };

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await POST(request());
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 404 when the student is not owned by the teacher", async () => {
    authenticateTeacher();
    mockStudentFindFirst.mockResolvedValue(null);

    const response = await POST(request());
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain("access denied");
    expect(mockStudentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "student-1", teacherId: "teacher-1" },
      }),
    );
  });

  it("returns 400 when there are no notes and no reports", async () => {
    authenticateTeacher();
    mockStudentFindFirst.mockResolvedValue({
      id: "student-1",
      notes: "   ",
      reports: [],
      learningBarriers: [],
    } as any);

    const response = await POST(request());
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("notes or at least one progress report");
    expect(mockGenerateFootpath).not.toHaveBeenCalled();
  });

  it("generates from notes alone, stores the result and returns it", async () => {
    authenticateTeacher();
    mockStudentFindFirst.mockResolvedValue({
      id: "student-1",
      name: "Maria",
      language: "Greek",
      grade: "B1",
      age: 14,
      learningBarriers: ["Dyslexia"],
      notes: "Loves football. Avoids long reading.",
      reports: [],
    } as any);
    mockGenerateFootpath.mockResolvedValue(FOOTPATH);
    (mockStudentUpdate as jest.Mock).mockImplementation(
      async (args: { data: Record<string, unknown> }) => ({
        learningFootpath: args.data.learningFootpath,
        footpathGeneratedAt: args.data.footpathGeneratedAt,
      }),
    );

    const response = await POST(request());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.learningFootpath).toEqual(FOOTPATH);
    expect(data.data.footpathGeneratedAt).toBeTruthy();
    expect(data.message).toContain("1-stage");

    expect(mockGenerateFootpath).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Maria",
        language: "Greek",
        learningBarriers: ["Dyslexia"],
        notes: "Loves football. Avoids long reading.",
        reports: [],
      }),
    );
    expect(mockStudentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "student-1" },
        data: expect.objectContaining({ learningFootpath: FOOTPATH }),
      }),
    );
  });

  it("forwards a descriptive error when the AI call fails", async () => {
    authenticateTeacher();
    mockStudentFindFirst.mockResolvedValue({
      id: "student-1",
      name: "Maria",
      language: "Greek",
      learningBarriers: [],
      notes: null,
      reports: [
        { title: "Week 1", content: "Good start", createdAt: new Date() },
      ],
    } as any);
    mockGenerateFootpath.mockRejectedValue(
      new Error("The AI did not return a usable footpath"),
    );

    const response = await POST(request());
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toContain("usable footpath");
    expect(mockStudentUpdate).not.toHaveBeenCalled();
  });
});
