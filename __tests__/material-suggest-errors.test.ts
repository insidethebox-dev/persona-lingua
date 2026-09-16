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
    studentThread: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/openai", () => ({
  analyzeStudentNeeds: jest.fn(),
  OPENAI_MODEL_RECOMMENDATION: "test-model",
}));

/* eslint-disable no-var */
var mockConversationsCreate: jest.Mock;
var mockResponsesCreate: jest.Mock;
/* eslint-enable no-var */

jest.mock("openai", () => {
  // Create stable mock functions at factory time (runs once)
  mockConversationsCreate = jest.fn();
  mockResponsesCreate = jest.fn();

  function MockOpenAI() {
    // @ts-ignore - mock constructor
    return {
      conversations: { create: mockConversationsCreate },
      responses: { create: mockResponsesCreate },
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

  /** Sets up a fully valid context: authenticated teacher, student with reports, no conversation yet */
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

    // No existing conversation — triggers conversation creation
    mockStudentThreadFindFirst.mockResolvedValue(null);
    mockConversationsCreate.mockResolvedValue({ id: "conv_123" });
    mockStudentThreadCreate.mockResolvedValue({
      id: "st-1",
      threadId: "conv_123",
      studentId: "student-1",
      teacherId: "teacher-1",
      assistantId: "test-model",
      status: "active",
    } as any);
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
  // Happy path — Responses API + Conversations
  // ====================================================================
  describe("Successful generation", () => {
    it("generates inside a new conversation and proofreads the result", async () => {
      setupValidContext();

      mockResponsesCreate
        .mockResolvedValueOnce({
          status: "completed",
          output_text: "# Reading Adventures\n\nDraft body",
        })
        .mockResolvedValueOnce({
          status: "completed",
          output_text: "# Reading Adventures\n\nPolished body",
        });

      const response = await POST(
        createMockRequest({ studentId: "student-1" }),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.threadId).toBe("conv_123");
      expect(data.data.generatedMaterial.title).toBe("Reading Adventures");
      expect(data.data.generatedMaterial.content).toContain("Polished body");

      // Generation turn ran inside the student's conversation
      expect(mockResponsesCreate).toHaveBeenCalledTimes(2);
      expect(mockResponsesCreate.mock.calls[0][0]).toMatchObject({
        model: "test-model",
        conversation: "conv_123",
      });
      expect(mockResponsesCreate.mock.calls[0][0].input[0].content).toContain(
        "TEACHER-GUIDED USE",
      );
    });

    it("keeps the original text when proofreading fails", async () => {
      setupValidContext();

      mockResponsesCreate
        .mockResolvedValueOnce({
          status: "completed",
          output_text: "# Title\n\nOriginal body",
        })
        .mockRejectedValueOnce(new Error("proofread down"));

      const response = await POST(
        createMockRequest({ studentId: "student-1" }),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.generatedMaterial.content).toContain("Original body");
    });

    it("archives a legacy Assistants thread and creates a conversation", async () => {
      setupValidContext();

      mockStudentThreadFindFirst.mockResolvedValue({
        id: "st-old",
        threadId: "thread_legacy",
        status: "active",
      } as any);
      mockResponsesCreate.mockResolvedValue({
        status: "completed",
        output_text: "# Title\n\nBody",
      });

      const response = await POST(
        createMockRequest({ studentId: "student-1" }),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockStudentThreadUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "st-old" },
          data: { status: "archived" },
        }),
      );
      expect(mockConversationsCreate).toHaveBeenCalledTimes(1);
      expect(data.data.threadId).toBe("conv_123");
    });

    it("reuses an existing conversation without creating a new one", async () => {
      setupValidContext();

      mockStudentThreadFindFirst.mockResolvedValue({
        id: "st-1",
        threadId: "conv_existing",
        assistantId: "test-model",
        status: "active",
      } as any);
      mockResponsesCreate.mockResolvedValue({
        status: "completed",
        output_text: "# Title\n\nBody",
      });

      const response = await POST(
        createMockRequest({ studentId: "student-1" }),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockConversationsCreate).not.toHaveBeenCalled();
      expect(data.data.threadId).toBe("conv_existing");
    });
  });

  // ====================================================================
  // AI Error Handling — the main focus of this test suite
  // ====================================================================
  describe("AI Error Handling", () => {
    it("should return a descriptive error when the AI response fails", async () => {
      setupValidContext();

      mockResponsesCreate.mockResolvedValue({
        status: "failed",
        error: { message: "Rate limit exceeded" },
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

    it("should return a descriptive error when the AI response fails with no specific reason", async () => {
      setupValidContext();

      mockResponsesCreate.mockResolvedValue({
        status: "failed",
        error: null,
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

    it("should return a descriptive error when the AI response is cancelled", async () => {
      setupValidContext();

      mockResponsesCreate.mockResolvedValue({ status: "cancelled" });

      const response = await POST(
        createMockRequest({ studentId: "student-1" }),
      );
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain("cancelled");
      expect(data.error).toContain("try again");
    });

    it("should return a descriptive error when the AI response is incomplete", async () => {
      setupValidContext();

      mockResponsesCreate.mockResolvedValue({
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
      });

      const response = await POST(
        createMockRequest({ studentId: "student-1" }),
      );
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain("max_output_tokens");
      expect(data.error).toContain("try again");
    });

    it("should return a descriptive error when the AI request times out", async () => {
      setupValidContext();

      mockResponsesCreate.mockRejectedValue(
        Object.assign(new Error("Request timed out."), {
          name: "APIConnectionTimeoutError",
        }),
      );

      const response = await POST(
        createMockRequest({ studentId: "student-1" }),
      );
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain("timed out");
      expect(data.error).toContain("taking longer than expected");
    });

    it("should return a descriptive error when the AI returns no response", async () => {
      setupValidContext();

      mockResponsesCreate.mockResolvedValue({
        status: "completed",
        output_text: "",
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

      // Network error when trying to create the conversation
      mockConversationsCreate.mockRejectedValue(
        new Error("connect ETIMEDOUT"),
      );

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
