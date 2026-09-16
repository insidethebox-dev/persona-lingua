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

// Reasoning models can take a while on long materials (serverless limit).
export const maxDuration = 300;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 240_000,
});

/**
 * Generate material using the OpenAI Responses API with a persistent
 * Conversation per student, so regenerations keep the previous context.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const teacher = await prisma.teacher.findUnique({
      where: { email: session.user.email },
    });

    if (!teacher) {
      return NextResponse.json(
        { success: false, error: "Teacher not found" },
        { status: 404 },
      );
    }

    const { studentId, isIndependentUse = false } = await request.json();

    if (!studentId) {
      return NextResponse.json(
        { success: false, error: "Student ID is required" },
        { status: 400 },
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
          take: 5, // Use recent reports for context
          select: {
            title: true,
            content: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!student) {
      return NextResponse.json(
        { success: false, error: "Student not found or access denied" },
        { status: 404 },
      );
    }

    if (!student.reports || student.reports.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No reports found for this student. Please create a progress report first to generate material suggestions.",
        },
        { status: 400 },
      );
    }

    // Build student context from profile and reports
    const reportContents = student.reports.map((report) => report.content);
    const reportMetadata = student.reports.map((report) => ({
      title: report.title,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    }));

    const studentContext = {
      name: student.name,
      language: student.language,
      grade: student.grade,
      age: student.age,
      learningBarriers: student.learningBarriers,
      reportMetadata,
    };

    // Analyze student needs using AI (same as recommendations)
    const studentNeeds = await analyzeStudentNeeds(
      reportContents,
      studentContext,
    );

    // Get or create the student's conversation (keeps context across regenerations)
    const { studentThread } = await getOrCreateStudentConversation(openai, {
      studentId: student.id,
      teacherId: teacher.id,
      sessionData: JSON.parse(
        JSON.stringify({
          studentName: student.name,
          language: student.language,
          grade: student.grade,
          age: student.age,
          studentNeeds,
        }),
      ),
    });
    const conversationId = studentThread.threadId;
    console.log("Using conversation:", conversationId);

    // Initial message with student context
    const recentReportsText = student.reports
      .map((r, i) => `${i + 1}. ${r.title}: ${r.content.substring(0, 300)}...`)
      .join("\n\n");

    const studentContextMessage = `Generate a complete learning material for the following student:

Student Profile:
- Name: ${student.name}
- Language: ${student.language}
- Grade: ${student.grade || "Not specified"}
- Age: ${student.age || "Not specified"}
- Learning Barriers: ${
      student.learningBarriers.length > 0
        ? student.learningBarriers.join(", ")
        : "None"
    }

Material Usage Mode: ${isIndependentUse ? "INDEPENDENT STUDENT USE" : "TEACHER-GUIDED USE"}
${
  isIndependentUse
    ? "This material will be used by the student independently with minimal teacher supervision. Make sure instructions are clear and self-explanatory."
    : "This material will be used by the teacher to guide instruction with the student. Include teacher notes and facilitation guidance."
}

AI-Identified Learning Needs:
- Topics: ${studentNeeds.topic.join(", ")}
- Levels: ${studentNeeds.level.join(", ")}
- Skills: ${studentNeeds.skill.join(", ")}
- Material Types: ${studentNeeds.type.join(", ")}
- Analysis: ${studentNeeds.reasoning}

Recent Progress Reports:
${recentReportsText}

Generate the complete material now.`;

    const generatedContent = await generateMaterialInConversation(openai, {
      conversationId,
      message: studentContextMessage,
      language: student.language,
      grade: student.grade,
    });

    const title = extractTitle(generatedContent);

    console.log("Material generated successfully");
    console.log("Conversation ID:", conversationId);

    // Update conversation logs in the student thread
    try {
      await prisma.studentThread.update({
        where: { id: studentThread.id },
        data: {
          conversationLogs: {
            push: JSON.parse(
              JSON.stringify({
                timestamp: new Date().toISOString(),
                type: "generation",
                studentContext: {
                  name: student.name,
                  language: student.language,
                  grade: student.grade,
                  age: student.age,
                },
                generatedTitle: title,
              }),
            ),
          },
        },
      });
      console.log("Conversation log updated");
    } catch (dbError) {
      console.error("Failed to update conversation log:", dbError);
      // Continue anyway - the material is still generated
    }

    // Build comprehensive context for the response
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
        // Kept for API compatibility with the client; assistants no longer exist.
        assistantId: studentThread.assistantId,
        threadId: conversationId,
        generatedMaterial: {
          title,
          content: generatedContent,
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
          // Pre-filled values for the upload form based on AI analysis
          language: student.language,
          topic: studentNeeds.topic[0] || "", // Primary topic
          level: studentNeeds.level[0] || "", // Primary level
          type: studentNeeds.type[0] || "", // Primary type
          skill: studentNeeds.skill[0] || "", // Primary skill
          tags: studentNeeds.tags,
          description: `Material suitable for ${student.name} focusing on: ${
            studentNeeds.reasoning.split(".")[0]
          }.`,
        },
        alternativeCriteria: {
          // Additional suggestions for variety
          topics: studentNeeds.topic,
          levels: studentNeeds.level,
          types: studentNeeds.type,
          skills: studentNeeds.skill,
        },
      },
      message: `Generated learning material for ${student.name} based on ${student.reports.length} recent report(s)`,
    });
  } catch (error) {
    console.error("Error generating material suggestions for student:", error);

    // Forward descriptive error messages from known failure modes
    const errorMessage =
      error instanceof Error && error.message
        ? error.message
        : "An unexpected error occurred while generating material suggestions. Please check your internet connection and try again.";

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 },
    );
  }
}
