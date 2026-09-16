import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeStudentNeeds } from "@/lib/openai";
import {
  extractTitle,
  generateMaterialInConversation,
  getOrCreateStudentConversation,
} from "@/lib/material-generation";
import OpenAI from "openai";

export const maxDuration = 300;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 240_000,
});

/**
 * Regenerate learning material with additional instructions, inside the
 * student's persistent Conversation (Responses API).
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

    const {
      studentId,
      additionalInstructions,
      isIndependentUse = false,
      currentMaterial,
    } = await request.json();

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

    // Get or create the student's conversation
    const { studentThread, isNew } = await getOrCreateStudentConversation(
      openai,
      {
        studentId,
        teacherId: teacher.id,
        sessionData: {
          studentName: student.name,
          language: student.language,
          grade: student.grade,
          age: student.age,
        },
      }
    );
    const conversationId = studentThread.threadId;

    const usageModeNote = isIndependentUse
      ? "Remember: This material is for INDEPENDENT STUDENT USE. Ensure instructions are clear and self-explanatory for students to use without teacher guidance."
      : "Remember: This material is for TEACHER-GUIDED USE. Include teacher notes and facilitation guidance.";

    // A brand-new conversation has no memory of the earlier material, so
    // include it verbatim when the client sent it along.
    const previousMaterialBlock =
      typeof currentMaterial === "string" && currentMaterial.trim() && isNew
        ? `\n\nHere is the current version of the material to revise:\n\n${currentMaterial}`
        : "";

    const message = `Please regenerate the learning material with the following additional instructions:\n\n${additionalInstructions}\n\n${usageModeNote}\n\nMaintain the same structure and format, but incorporate these changes.${previousMaterialBlock}`;

    const regeneratedContent = await generateMaterialInConversation(openai, {
      conversationId,
      message,
      language: student.language,
      grade: student.grade,
    });

    const title = extractTitle(regeneratedContent);

    // Log the conversation in the student thread
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

    // Re-analyze to get metadata for the response
    const reportContents = student.reports.map((report) => report.content);
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
        assistantId: studentThread.assistantId,
        threadId: conversationId,
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
      message: `Regenerated learning material for ${student.name}`,
    });
  } catch (error) {
    console.error("Error regenerating material for student:", error);

    const errorMessage =
      error instanceof Error && error.message
        ? error.message
        : "An unexpected error occurred while regenerating the material. Please try again.";

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
