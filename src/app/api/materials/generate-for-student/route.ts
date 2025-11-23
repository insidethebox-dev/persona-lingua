import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeStudentNeeds } from "@/lib/openai";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate material using OpenAI Assistants API for persistent conversations
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

    const { studentId } = await request.json();

    if (!studentId) {
      return NextResponse.json(
        { success: false, error: "Student ID is required" },
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
        { status: 404 }
      );
    }

    if (!student.reports || student.reports.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No reports found for this student. Please create a progress report first to generate material suggestions.",
        },
        { status: 400 }
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
      studentContext
    );

    // Create an OpenAI Assistant for this student
    const assistant = await openai.beta.assistants.create({
      name: `Material Creator for ${student.name}`,
      instructions: `You are an expert educational content creator specializing in personalized learning materials. Your task is to generate complete, ready-to-use learning materials that teachers can immediately use with their students.

Student Profile:
- Name: ${student.name}
- Language: ${student.language}
- Grade: ${student.grade || "Not specified"}
- Age: ${student.age || "Not specified"}
- Learning Barriers: ${student.learningBarriers.length > 0 ? student.learningBarriers.join(", ") : "None"}

AI-Identified Learning Needs:
- Topics: ${studentNeeds.topic.join(", ")}
- Levels: ${studentNeeds.level.join(", ")}
- Skills: ${studentNeeds.skill.join(", ")}
- Material Types: ${studentNeeds.type.join(", ")}
- Analysis: ${studentNeeds.reasoning}

Generate complete learning materials that:
1. Are appropriate for the student's level and needs
2. Address the identified learning gaps
3. Are engaging and suitable for their age/grade
4. Take into account any learning barriers
5. Are in ${student.language} language
6. Include clear instructions for both teacher and student
7. Have exercises, activities, or content that can be completed

Format materials as structured documents with:
- A clear title
- Learning objectives
- Instructions
- Main content/activities
- Assessment or reflection questions (if applicable)

Be thorough, engaging, and pedagogically sound.`,
      model: "gpt-4-turbo-preview",
    });

    console.log("Assistant created:", assistant.id);

    // Create a thread and generate initial material
    const thread = await openai.beta.threads.create();
    
    console.log("Thread created:", thread.id);

    if (!thread.id) {
      throw new Error("Failed to create thread - no thread ID returned");
    }

    // Add initial message
    const recentReportsText = student.reports
      .map((r, i) => `${i + 1}. ${r.title}: ${r.content.substring(0, 300)}...`)
      .join("\n\n");

    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: `Based on the student profile and recent progress reports below, please generate a complete learning material.\n\nRecent Progress Reports:\n${recentReportsText}\n\nGenerate the complete material now.`,
    });

    console.log("Message added to thread");

    // Run the assistant
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistant.id,
    });

    console.log("Run created:", run.id);

    // Store thread ID in a variable to ensure it's preserved
    const threadId = thread.id;
    const runId = run.id;

    console.log("Using threadId:", threadId, "runId:", runId);

    // Poll for completion
    let runStatus = await openai.beta.threads.runs.retrieve(runId, {
      thread_id: threadId,
    });
    let attempts = 0;
    const maxAttempts = 30;

    while (runStatus.status !== "completed" && attempts < maxAttempts) {
      if (runStatus.status === "failed" || runStatus.status === "cancelled") {
        throw new Error(`Assistant run ${runStatus.status}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(runId, {
        thread_id: threadId,
      });
      attempts++;
    }

    if (runStatus.status !== "completed") {
      throw new Error("Assistant run timed out");
    }

    console.log("Run completed successfully");

    // Retrieve the assistant's response
    const messages = await openai.beta.threads.messages.list(threadId);
    const lastMessage = messages.data[0];

    if (lastMessage.role !== "assistant") {
      throw new Error("No assistant response found");
    }

    const messageContent = lastMessage.content[0];
    let generatedContent = "";

    if (messageContent.type === "text") {
      generatedContent = messageContent.text.value;
    }

    // Parse title from content
    const lines = generatedContent.split("\n");
    const titleLine = lines.find((line) => line.trim().length > 0) || "Learning Material";
    const title = titleLine
      .replace(/^#+\s*/, "")
      .replace(/^\*\*/, "")
      .replace(/\*\*$/, "")
      .trim();

    console.log("Storing assistant in database...");
    console.log("Assistant ID:", assistant.id);
    console.log("Thread ID:", threadId);
    console.log("Student ID:", student.id);
    console.log("Teacher ID:", teacher.id);

    // Store assistant info in database
    try {
      const assistantRecord = await prisma.teacherAssistant.create({
        data: {
          assistantId: assistant.id,
          threadId: threadId,
          studentId: student.id,
          teacherId: teacher.id,
          sessionData: JSON.parse(JSON.stringify({
            studentName: student.name,
            language: student.language,
            grade: student.grade,
            age: student.age,
            studentNeeds,
          })),
          status: "active",
        },
      });
      console.log("Assistant record created:", assistantRecord.id);
    } catch (dbError) {
      console.error("Failed to save assistant to database:", dbError);
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
        assistantId: assistant.id,
        threadId: threadId,
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
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate material suggestions",
      },
      { status: 500 }
    );
  }
}
