import type OpenAI from "openai";
import type { Prisma, StudentThread } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { OPENAI_MODEL_RECOMMENDATION } from "@/lib/openai";

/**
 * Helpers for the "Suggest Materials" flow.
 *
 * The flow used to run on the Assistants API (assistants + threads + runs),
 * which OpenAI sunset on 2026-08-26. It now runs on the Responses API with a
 * server-side Conversation per student so that regenerations keep the context
 * of the previously generated material. The existing `student_threads` table
 * is reused: `threadId` holds the Conversation id (`conv_...`). Records that
 * still hold a legacy `thread_...` id are archived and replaced on first use.
 */

const CONVERSATION_ID_PREFIX = "conv_";

export const TEACHER_GUIDED_INSTRUCTIONS = `Your materials are designed for teachers to use in guided instruction with their students. Include:
1. Clear teacher notes and facilitation guidance
2. Discussion prompts and questions for the teacher to ask
3. Scaffolding suggestions for different learning levels
4. Ideas for differentiation and extension activities
5. Tips for checking understanding during the lesson
6. Suggested pacing and timing for each section
7. Guidance on how to support students with learning barriers`;

export const INDEPENDENT_USE_INSTRUCTIONS = `Your materials are designed for students to use independently with minimal teacher supervision. Include:
1. Clear, self-explanatory instructions that students can follow on their own
2. Step-by-step guidance with examples
3. Self-check questions and answer keys where appropriate
4. Engaging activities that maintain student interest
5. Built-in support for students who might struggle (hints, tips)
6. Clear success criteria so students know when they've completed tasks correctly
7. Reflection questions for self-assessment`;

/** System instructions for material generation (formerly the Assistant's instructions). */
export function buildMaterialInstructions(): string {
  return `You are an expert educational content creator specializing in personalized learning materials.

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
${TEACHER_GUIDED_INSTRUCTIONS}

WHEN MATERIAL IS FOR INDEPENDENT STUDENT USE:
${INDEPENDENT_USE_INSTRUCTIONS}

Format materials as structured documents with:
- A clear title
- Learning objectives
- Instructions (tailored to the usage mode)
- Main content/activities
- Assessment or reflection questions (if applicable)

Be thorough, engaging, and pedagogically sound.`;
}

export function isConversationId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(CONVERSATION_ID_PREFIX);
}

interface ConversationContext {
  studentId: string;
  teacherId: string;
  sessionData?: Prisma.InputJsonValue;
}

/**
 * Find the student's active conversation record, or create a new OpenAI
 * Conversation and record it. Returns the record and whether it was created
 * on this call (a fresh conversation has no memory of earlier material).
 */
export async function getOrCreateStudentConversation(
  client: OpenAI,
  context: ConversationContext
): Promise<{ studentThread: StudentThread; isNew: boolean }> {
  const existing = await prisma.studentThread.findFirst({
    where: {
      studentId: context.studentId,
      teacherId: context.teacherId,
      status: "active",
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing && isConversationId(existing.threadId)) {
    return { studentThread: existing, isNew: false };
  }

  if (existing) {
    // Legacy Assistants-API thread: archive it, a conversation replaces it.
    await prisma.studentThread.update({
      where: { id: existing.id },
      data: { status: "archived" },
    });
  }

  const conversation = await client.conversations.create({
    metadata: {
      studentId: context.studentId,
      teacherId: context.teacherId,
    },
  });

  const studentThread = await prisma.studentThread.create({
    data: {
      threadId: conversation.id,
      studentId: context.studentId,
      teacherId: context.teacherId,
      assistantId: OPENAI_MODEL_RECOMMENDATION, // no assistants anymore; record the model
      sessionData: context.sessionData,
      status: "active",
    },
  });

  return { studentThread, isNew: true };
}

interface GenerateInContext {
  conversationId: string;
  message: string;
  language: string;
  grade: string | null;
}

/**
 * Run one generation turn inside the student's conversation and proofread the
 * result. Throws teacher-friendly errors for the known failure modes.
 */
export async function generateMaterialInConversation(
  client: OpenAI,
  context: GenerateInContext
): Promise<string> {
  let response;
  try {
    response = await client.responses.create({
      model: OPENAI_MODEL_RECOMMENDATION,
      instructions: buildMaterialInstructions(),
      conversation: context.conversationId,
      input: [{ role: "user", content: context.message }],
      reasoning: { effort: "medium" },
      max_output_tokens: 8000,
    });
  } catch (error) {
    if ((error as Error)?.name === "APIConnectionTimeoutError") {
      throw new Error(
        "Material generation timed out. The AI is taking longer than expected — this can happen with complex student profiles. Please try again in a few minutes."
      );
    }
    throw error;
  }

  if (response.status === "failed") {
    const failReason = response.error?.message || "Unknown error";
    throw new Error(
      `The AI engine failed to generate material: ${failReason}. Please try again or contact support if the issue persists.`
    );
  }
  if (response.status === "cancelled") {
    throw new Error("Material generation was cancelled. Please try again.");
  }
  if (response.status === "incomplete") {
    const reason = response.incomplete_details?.reason || "unknown reason";
    throw new Error(
      `The AI stopped before finishing the material (${reason}). Please try again.`
    );
  }

  const content = response.output_text?.trim() ?? "";
  if (!content) {
    throw new Error(
      "The AI did not return a response. This is an unexpected error — please try again. If the problem continues, try adding more detail to the student's progress reports."
    );
  }

  return proofread(client, content, context.language, context.grade);
}

/** Quality control pass. Falls back to the original text on any failure. */
async function proofread(
  client: OpenAI,
  content: string,
  language: string,
  grade: string | null
): Promise<string> {
  console.log("Proofreading generated content...");
  try {
    const response = await client.responses.create({
      model: OPENAI_MODEL_RECOMMENDATION,
      instructions: `You are an expert proofreader and editor specializing in educational materials. Your task is to:
1. Fix all grammatical errors, spelling mistakes, and punctuation issues
2. Improve clarity and readability while maintaining the original meaning and structure
3. Ensure the language is appropriate for the target audience (${language}, ${
        grade || "appropriate level"
      })
4. Maintain the original formatting (markdown, headings, lists, etc.)
5. Keep all the original content - DO NOT remove sections or change the structure
6. Make the text natural and engaging

Return ONLY the corrected text with no additional comments or explanations.`,
      input: `Please proofread and correct the following educational material for grammatical errors and clarity:\n\n${content}`,
      reasoning: { effort: "low" },
      max_output_tokens: 8000,
    });

    const corrected = response.output_text?.trim();
    if (response.status === "completed" && corrected) {
      console.log("Content proofread successfully");
      return corrected;
    }
  } catch (proofreadError) {
    console.error(
      "Proofreading failed, using original content:",
      proofreadError
    );
  }
  return content;
}

/** Derive a title from the first non-empty line of generated markdown. */
export function extractTitle(content: string): string {
  const lines = content.split("\n");
  const titleLine =
    lines.find((line) => line.trim().length > 0) || "Learning Material";
  return titleLine
    .replace(/^#+\s*/, "")
    .replace(/^\*\*/, "")
    .replace(/\*\*$/, "")
    .trim();
}
