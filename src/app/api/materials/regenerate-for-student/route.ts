import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Regenerate learning material with additional instructions using OpenAI Assistants API
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const teacher = await prisma.teacher.findUnique({
      where: { email: session.user.email },
    });

    if (!teacher) {
      return NextResponse.json(
        { success: false, error: "Teacher not found" },
        { status: 404 }
      );
    }

    const { studentId, additionalInstructions } = await request.json();

    if (!studentId || !additionalInstructions) {
      return NextResponse.json(
        {
          success: false,
          error: "Student ID and additional instructions are required",
        },
        { status: 400 }
      );
    }

    // Verify the student belongs to this teacher
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        teacherId: teacher.id,
      },
      include: {
        reports: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    if (!student) {
      return NextResponse.json(
        { success: false, error: "Student not found or access denied" },
        { status: 404 }
      );
    }

    // Get the teacher's assistant (should exist from initial generation)
    const teacherAssistant = await prisma.teacherAssistant.findFirst({
      where: {
        teacherId: teacher.id,
        threadId: null, // New-style records have no threadId
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!teacherAssistant) {
      return NextResponse.json(
        {
          success: false,
          error: "No assistant found. Please generate material first.",
        },
        { status: 400 }
      );
    }

    const currentAssistantId = teacherAssistant.assistantId;

    // Get or create the student's thread
    let studentThread = await prisma.studentThread.findFirst({
      where: {
        studentId,
        teacherId: teacher.id,
        status: "active",
      },
    });

    let currentThreadId: string;

    if (!studentThread) {
      // Create a new thread if none exists
      const thread = await openai.beta.threads.create();
      currentThreadId = thread.id;

      studentThread = await prisma.studentThread.create({
        data: {
          threadId: currentThreadId,
          studentId,
          teacherId: teacher.id,
          assistantId: currentAssistantId,
          sessionData: {
            studentName: student.name,
            language: student.language,
            grade: student.grade,
            age: student.age,
          },
          status: "active",
        },
      });
    } else {
      currentThreadId = studentThread.threadId;
    }

    // Add the user's additional instructions to the thread
    await openai.beta.threads.messages.create(currentThreadId, {
      role: "user",
      content: `Please regenerate the learning material with the following additional instructions:\n\n${additionalInstructions}\n\nMaintain the same structure and format, but incorporate these changes.`,
    });

    // Run the assistant
    const run = await openai.beta.threads.runs.create(currentThreadId, {
      assistant_id: currentAssistantId,
    });

    // Store IDs in variables to avoid scope issues
    const retrieveThreadId = currentThreadId;
    const retrieveRunId = run.id;

    // Poll for completion
    let runStatus = await openai.beta.threads.runs.retrieve(retrieveRunId, {
      thread_id: retrieveThreadId,
    });

    let attempts = 0;
    const maxAttempts = 30; // 30 seconds timeout

    while (runStatus.status !== "completed" && attempts < maxAttempts) {
      if (runStatus.status === "failed" || runStatus.status === "cancelled") {
        throw new Error(`Assistant run ${runStatus.status}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(retrieveRunId, {
        thread_id: retrieveThreadId,
      });
      attempts++;
    }

    if (runStatus.status !== "completed") {
      throw new Error("Assistant run timed out");
    }

    // Retrieve the assistant's response
    const messages = await openai.beta.threads.messages.list(retrieveThreadId);
    const lastMessage = messages.data[0];

    if (lastMessage.role !== "assistant") {
      throw new Error("No assistant response found");
    }

    const messageContent = lastMessage.content[0];
    let regeneratedContent = "";

    if (messageContent.type === "text") {
      regeneratedContent = messageContent.text.value;
    }

    // Parse the regenerated content
    const lines = regeneratedContent.split("\n");
    const titleLine =
      lines.find((line) => line.trim().length > 0) || "Learning Material";
    const title = titleLine
      .replace(/^#+\s*/, "")
      .replace(/^\*\*/, "")
      .replace(/\*\*$/, "")
      .trim();

    // Log the conversation in the student thread
    if (studentThread) {
      await prisma.studentThread.update({
        where: { id: studentThread.id },
        data: {
          conversationLogs: {
            push: JSON.parse(
              JSON.stringify({
                instruction: additionalInstructions,
                timestamp: new Date().toISOString(),
                type: "regeneration",
                generatedTitle: title,
              })
            ),
          },
        },
      });
    }

    // Get the original analysis from student reports
    const reportContents = student.reports.map((report) => report.content);

    // Re-analyze to get metadata (or retrieve from stored session data)
    const { analyzeStudentNeeds } = await import("@/lib/openai");
    const studentNeeds = await analyzeStudentNeeds(reportContents, {
      name: student.name,
      language: student.language,
      grade: student.grade,
      age: student.age,
      learningBarriers: student.learningBarriers,
      reportMetadata: student.reports.map((r) => ({
        title: r.title,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    });

    // Build response with same structure
    const suggestionContext = {
      studentProfile: {
        name: student.name,
        language: student.language,
        grade: student.grade || "Not specified",
        age: student.age || "Not specified",
        learningBarriers:
          student.learningBarriers.length > 0
            ? student.learningBarriers.join(", ")
            : "None",
      },
      aiAnalysis: {
        recommendedTopics: studentNeeds.topic,
        recommendedLevels: studentNeeds.level,
        recommendedTypes: studentNeeds.type,
        recommendedSkills: studentNeeds.skill,
        suggestedTags: studentNeeds.tags,
        reasoning: studentNeeds.reasoning,
      },
      recentReports: student.reports.map((r) => ({
        title: r.title,
        excerpt: r.content.substring(0, 200) + "...",
        date: r.createdAt,
      })),
    };

    return NextResponse.json({
      success: true,
      data: {
        studentId: student.id,
        studentName: student.name,
        assistantId: currentAssistantId,
        threadId: currentThreadId,
        generatedMaterial: {
          title,
          content: regeneratedContent,
          metadata: {
            topic: studentNeeds.topic[0] || "General",
            level: studentNeeds.level[0] || "Mixed",
            skill: studentNeeds.skill[0] || "Multiple Skills",
            language: student.language,
            estimatedDuration: "30-45 minutes",
          },
        },
        suggestions: suggestionContext,
        materialCriteria: {
          language: student.language,
          topic: studentNeeds.topic[0] || "",
          level: studentNeeds.level[0] || "",
          type: studentNeeds.type[0] || "",
          skill: studentNeeds.skill[0] || "",
          tags: studentNeeds.tags,
          description: `Material suitable for ${student.name} focusing on: ${
            studentNeeds.reasoning.split(".")[0]
          }.`,
        },
        alternativeCriteria: {
          topics: studentNeeds.topic,
          levels: studentNeeds.level,
          types: studentNeeds.type,
          skills: studentNeeds.skill,
        },
      },
      message: `Material regenerated for ${student.name}`,
    });
  } catch (error) {
    console.error("Error regenerating material for student:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to regenerate material",
      },
      { status: 500 }
    );
  }
}
