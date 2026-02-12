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

    // Get or create the teacher's assistant (one per teacher)
    let teacherAssistant = await prisma.teacherAssistant.findFirst({
      where: {
        teacherId: teacher.id,
        threadId: null, // New-style records have no threadId
      },
      orderBy: { createdAt: "desc" },
    });

    let assistantId: string;

    if (!teacherAssistant) {
      // Create a new assistant for this teacher
      const baseInstructions = `You are an expert educational content creator specializing in personalized learning materials.`;

      const teacherGuidedInstructions = `Your materials are designed for teachers to use in guided instruction with their students. Include:
1. Clear teacher notes and facilitation guidance
2. Discussion prompts and questions for the teacher to ask
3. Scaffolding suggestions for different learning levels
4. Ideas for differentiation and extension activities
5. Tips for checking understanding during the lesson
6. Suggested pacing and timing for each section
7. Guidance on how to support students with learning barriers`;

      const independentUseInstructions = `Your materials are designed for students to use independently with minimal teacher supervision. Include:
1. Clear, self-explanatory instructions that students can follow on their own
2. Step-by-step guidance with examples
3. Self-check questions and answer keys where appropriate
4. Engaging activities that maintain student interest
5. Built-in support for students who might struggle (hints, tips)
6. Clear success criteria so students know when they've completed tasks correctly
7. Reflection questions for self-assessment`;

      const assistant = await openai.beta.assistants.create({
        name: `Educational Material Creator for ${teacher.name}`,
        instructions: `${baseInstructions}

For each request, you will receive:
- Student profile (name, language, grade, age, learning barriers)
- AI-identified learning needs
- Recent progress reports
- Material usage mode (teacher-guided or independent)

Generate complete learning materials that:
1. Are appropriate for the student's level and needs
2. Address the identified learning gaps
3. Are engaging and suitable for their age/grade
4. Take into account any learning barriers
5. Are in the specified language
6. Match the intended usage mode (teacher-guided or independent)

WHEN MATERIAL IS FOR TEACHER-GUIDED USE:
${teacherGuidedInstructions}

WHEN MATERIAL IS FOR INDEPENDENT STUDENT USE:
${independentUseInstructions}

Format materials as structured documents with:
- A clear title
- Learning objectives
- Instructions (tailored to the usage mode)
- Main content/activities
- Assessment or reflection questions (if applicable)

Be thorough, engaging, and pedagogically sound.`,
        model: "gpt-4-turbo-preview",
      });

      console.log("Created new assistant for teacher:", assistant.id);

      // Store in database
      teacherAssistant = await prisma.teacherAssistant.create({
        data: {
          assistantId: assistant.id,
          teacherId: teacher.id,
          status: "active",
        },
      });

      assistantId = assistant.id;
    } else {
      assistantId = teacherAssistant.assistantId;
      console.log("Using existing assistant:", assistantId);
    }

    // Check if a thread already exists for this student
    let studentThread = await prisma.studentThread.findFirst({
      where: {
        studentId: student.id,
        teacherId: teacher.id,
        status: "active",
      },
    });

    let threadId: string;

    if (!studentThread) {
      // Create a new thread for this student
      const thread = await openai.beta.threads.create();
      console.log("Created new thread:", thread.id);

      threadId = thread.id;

      // Store in database
      studentThread = await prisma.studentThread.create({
        data: {
          threadId: thread.id,
          studentId: student.id,
          teacherId: teacher.id,
          assistantId: assistantId,
          sessionData: JSON.parse(
            JSON.stringify({
              studentName: student.name,
              language: student.language,
              grade: student.grade,
              age: student.age,
              studentNeeds,
            }),
          ),
          status: "active",
        },
      });
    } else {
      threadId = studentThread.threadId;
      console.log("Using existing thread:", threadId);
    }

    // Add initial message with student context
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

    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: studentContextMessage,
    });

    console.log("Message added to thread");

    // Run the assistant
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: assistantId,
    });

    console.log("Run created:", run.id);

    // Store run ID in a variable
    const runId = run.id;

    console.log("Using threadId:", threadId, "runId:", runId);

    // Poll for completion
    let runStatus = await openai.beta.threads.runs.retrieve(runId, {
      thread_id: threadId,
    });
    let attempts = 0;
    const maxAttempts = 30;

    while (runStatus.status !== "completed" && attempts < maxAttempts) {
      if (runStatus.status === "failed") {
        const failReason = runStatus.last_error?.message || "Unknown error";
        throw new Error(
          `The AI engine failed to generate material: ${failReason}. Please try again or contact support if the issue persists.`,
        );
      }
      if (runStatus.status === "cancelled") {
        throw new Error("Material generation was cancelled. Please try again.");
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(runId, {
        thread_id: threadId,
      });
      attempts++;
    }

    if (runStatus.status !== "completed") {
      throw new Error(
        "Material generation timed out. The AI is taking longer than expected — this can happen with complex student profiles. Please try again in a few minutes.",
      );
    }

    console.log("Run completed successfully");

    // Retrieve the assistant's response
    const messages = await openai.beta.threads.messages.list(threadId);
    const lastMessage = messages.data[0];

    if (lastMessage.role !== "assistant") {
      throw new Error(
        "The AI did not return a response. This is an unexpected error — please try again. If the problem continues, try adding more detail to the student's progress reports.",
      );
    }

    const messageContent = lastMessage.content[0];
    let generatedContent = "";

    if (messageContent.type === "text") {
      generatedContent = messageContent.text.value;
    }

    // QUALITY CONTROL: Proofread the generated content for grammar and clarity
    console.log("Proofreading generated content...");
    try {
      const proofreadCompletion = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: `You are an expert proofreader and editor specializing in educational materials. Your task is to:
1. Fix all grammatical errors, spelling mistakes, and punctuation issues
2. Improve clarity and readability while maintaining the original meaning and structure
3. Ensure the language is appropriate for the target audience (${student.language}, ${student.grade || "appropriate level"})
4. Maintain the original formatting (markdown, headings, lists, etc.)
5. Keep all the original content - DO NOT remove sections or change the structure
6. Make the text natural and engaging

Return ONLY the corrected text with no additional comments or explanations.`,
          },
          {
            role: "user",
            content: `Please proofread and correct the following educational material for grammatical errors and clarity:\n\n${generatedContent}`,
          },
        ],
        temperature: 0.3, // Low temperature for consistent, accurate corrections
      });

      const proofreadContent = proofreadCompletion.choices[0]?.message?.content;
      if (proofreadContent && proofreadContent.trim()) {
        generatedContent = proofreadContent;
        console.log("Content proofread successfully");
      }
    } catch (proofreadError) {
      console.error(
        "Proofreading failed, using original content:",
        proofreadError,
      );
      // Continue with original content if proofreading fails
    }

    // Parse title from content
    const lines = generatedContent.split("\n");
    const titleLine =
      lines.find((line) => line.trim().length > 0) || "Learning Material";
    const title = titleLine
      .replace(/^#+\s*/, "")
      .replace(/^\*\*/, "")
      .replace(/\*\*$/, "")
      .trim();

    console.log("Material generated successfully");
    console.log("Assistant ID:", assistantId);
    console.log("Thread ID:", threadId);

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
        assistantId: assistantId,
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
