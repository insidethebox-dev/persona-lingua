import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { analyzeStudentNeeds } from "@/lib/openai";

// ======================================================================
// MOCK SETUP — all mocks use `var` for jest hoisting compatibility
// ======================================================================

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  authOptions: {},
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    teacher: { findUnique: jest.fn() },
    student: { findFirst: jest.fn() },
    teacherAssistant: { findFirst: jest.fn(), create: jest.fn() },
    studentThread: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/openai", () => ({
  analyzeStudentNeeds: jest.fn(),
}));

/* eslint-disable no-var */
var mockAssistantsCreate: jest.Mock;
var mockThreadsCreate: jest.Mock;
var mockMessagesCreate: jest.Mock;
var mockMessagesList: jest.Mock;
var mockRunsCreate: jest.Mock;
var mockRunsRetrieve: jest.Mock;
var mockChatCompletionsCreate: jest.Mock;
/* eslint-enable no-var */

jest.mock("openai", () => {
  // Create stable mock functions at factory time (runs once)
  mockAssistantsCreate = jest.fn();
  mockThreadsCreate = jest.fn();
  mockMessagesCreate = jest.fn();
  mockMessagesList = jest.fn();
  mockRunsCreate = jest.fn();
  mockRunsRetrieve = jest.fn();
  mockChatCompletionsCreate = jest.fn();

  function MockOpenAI() {
    // @ts-ignore - mock constructor
    return {
      beta: {
        assistants: { create: mockAssistantsCreate },
        threads: {
          create: mockThreadsCreate,
          messages: { create: mockMessagesCreate, list: mockMessagesList },
          runs: { create: mockRunsCreate, retrieve: mockRunsRetrieve },
        },
      },
      chat: {
        completions: { create: mockChatCompletionsCreate },
      },
    };
  }

  MockOpenAI.default = MockOpenAI;
  return MockOpenAI;
});

// Typed aliases for prisma mocks
const mockGetServerSession = getServerSession as jest.MockedFunction<
  typeof getServerSession
>;
const mockTeacherFindUnique = prisma.teacher.findUnique as jest.MockedFunction<
  typeof prisma.teacher.findUnique
>;
const mockStudentFindFirst = prisma.student.findFirst as jest.MockedFunction<
  typeof prisma.student.findFirst
>;
const mockTeacherAssistantFindFirst = prisma.teacherAssistant
  .findFirst as jest.MockedFunction<typeof prisma.teacherAssistant.findFirst>;
const mockStudentThreadFindFirst = prisma.studentThread
  .findFirst as jest.MockedFunction<typeof prisma.studentThread.findFirst>;
const mockStudentThreadCreate = prisma.studentThread
  .create as jest.MockedFunction<typeof prisma.studentThread.create>;
const mockStudentThreadUpdate = prisma.studentThread
  .update as jest.MockedFunction<typeof prisma.studentThread.update>;
const mockAnalyzeStudentNeeds = analyzeStudentNeeds as jest.MockedFunction<
  typeof analyzeStudentNeeds
>;

// ======================================================================
// Import under test AFTER all mocks are set up
// ======================================================================
import { POST } from "@/app/api/materials/generate-for-student/route";

// ======================================================================
// TEST SUITE
// ======================================================================
describe("POST /api/materials/generate-for-student", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockRequest = (body: Record<string, unknown>) =>
    new NextRequest(
      "http://localhost:3000/api/materials/generate-for-student",
      {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      },
    );

  /** Sets up a fully valid context: authenticated teacher, student with reports, existing assistant */
  const setupValidContext = () => {
    mockGetServerSession.mockResolvedValue({
      user: { email: "teacher@school.com" },
    } as any);

    mockTeacherFindUnique.mockResolvedValue({
      id: "teacher-1",
      name: "Test Teacher",
      email: "teacher@school.com",
    } as any);

    mockStudentFindFirst.mockResolvedValue({
      id: "student-1",
      name: "Test Student",
      language: "English",
      grade: "5th",
      age: 11,
      learningBarriers: [],
      teacherId: "teacher-1",
      reports: [
        {
          title: "Progress Report 1",
          content:
            "The student is making good progress in reading comprehension.",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    } as any);

    mockAnalyzeStudentNeeds.mockResolvedValue({
      topic: ["Daily Life"],
      level: ["A2.1 (Elementary Low)"],
      type: ["Worksheet"],
      skill: ["Reading"],
      tags: ["reading", "comprehension"],
      reasoning: "Based on analysis, the student needs reading materials.",
    });

    // Existing assistant — no need to create one
    mockTeacherAssistantFindFirst.mockResolvedValue({
      id: "ta-1",
      assistantId: "asst_123",
      teacherId: "teacher-1",
      status: "active",
    } as any);

    // No existing thread — triggers thread creation
    mockStudentThreadFindFirst.mockResolvedValue(null);

    mockThreadsCreate.mockResolvedValue({ id: "thread_123" });

    mockStudentThreadCreate.mockResolvedValue({
      id: "st-1",
      threadId: "thread_123",
      studentId: "student-1",
      teacherId: "teacher-1",
      assistantId: "asst_123",
      status: "active",
    } as any);

    mockMessagesCreate.mockResolvedValue({});
    mockRunsCreate.mockResolvedValue({ id: "run_123" });
    mockStudentThreadUpdate.mockResolvedValue({} as any);
  };

  // ====================================================================
  // Authentication & Validation
  // ====================================================================
  describe("Authentication & Validation", () => {
    it("should return 401 if user is not authenticated", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const response = await POST(
        createMockRequest({ studentId: "student-1" }),
      );
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Unauthorized");
    });

    it("should return 400 if studentId is missing", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: "t@s.com" },
      } as any);
      mockTeacherFindUnique.mockResolvedValue({ id: "teacher-1" } as any);

      const response = await POST(createMockRequest({}));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Student ID is required");
    });

    it("should return 400 if student has no reports", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: "t@s.com" },
      } as any);
      mockTeacherFindUnique.mockResolvedValue({ id: "teacher-1" } as any);
      mockStudentFindFirst.mockResolvedValue({
        id: "student-1",
        teacherId: "teacher-1",
        reports: [],
      } as any);

      const response = await POST(
        createMockRequest({ studentId: "student-1" }),
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("No reports found");
    });
  });

  // ====================================================================
  // AI Error Handling — the main focus of this test suite
  // ====================================================================
  describe("AI Error Handling", () => {
    it("should return a descriptive error when the AI run fails", async () => {
      setupValidContext();

      mockRunsRetrieve.mockResolvedValue({
        status: "failed",
        last_error: { message: "Rate limit exceeded" },
      });

      const response = await POST(
        createMockRequest({ studentId: "student-1" }),
      );
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain("AI engine failed");
      expect(data.error).toContain("Rate limit exceeded");
      expect(data.error).toContain("try again");
    });

    it("should return a descriptive error when the AI run fails with no specific reason", async () => {
      setupValidContext();

      mockRunsRetrieve.mockResolvedValue({
        status: "failed",
        last_error: null,
      });

      const response = await POST(
        createMockRequest({ studentId: "student-1" }),
      );
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain("AI engine failed");
      expect(data.error).toContain("Unknown error");
    });

    it("should return a descriptive error when the AI run is cancelled", async () => {
      setupValidContext();

      mockRunsRetrieve.mockResolvedValue({ status: "cancelled" });

      const response = await POST(
        createMockRequest({ studentId: "student-1" }),
      );
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain("cancelled");
      expect(data.error).toContain("try again");
    });

    it("should return a descriptive error when the AI run times out", async () => {
      setupValidContext();

      // Always return "in_progress" to simulate the polling loop exhausting maxAttempts
      mockRunsRetrieve.mockResolvedValue({ status: "in_progress" });

      const response = await POST(
        createMockRequest({ studentId: "student-1" }),
      );
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain("timed out");
      expect(data.error).toContain("taking longer than expected");
    }, 60000); // Route polls 30x with 1s delays, needs ~31s

    it("should return a descriptive error when the AI returns no response", async () => {
      setupValidContext();

      // Run completes successfully...
      mockRunsRetrieve.mockResolvedValue({ status: "completed" });

      // ...but no assistant message in the thread
      mockMessagesList.mockResolvedValue({
        data: [
          {
            role: "user",
            content: [{ type: "text", text: { value: "User message" } }],
          },
        ],
      });

      const response = await POST(
        createMockRequest({ studentId: "student-1" }),
      );
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain("AI did not return a response");
      expect(data.error).toContain("try again");
    });

    it("should return a descriptive error when the OpenAI API is unreachable", async () => {
      setupValidContext();

      // Network error when trying to create the thread run
      mockRunsCreate.mockRejectedValue(new Error("connect ETIMEDOUT"));

      const response = await POST(
        createMockRequest({ studentId: "student-1" }),
      );
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain("ETIMEDOUT");
    });
  });
});
