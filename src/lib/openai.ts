import OpenAI from "openai";
import type {
  FunctionTool,
  Response as OpenAIResponse,
} from "openai/resources/responses/responses";

/**
 * Shared OpenAI client.
 *
 * All calls go through the Responses API (`openai.responses.create`), which is
 * the API OpenAI now recommends for new integrations and the only one that
 * supports tool calling on GPT-6 Astra. The legacy Chat Completions
 * `functions` / `function_call` parameters and the Assistants API (sunset
 * 2026-08-26) are no longer used anywhere in the app.
 */
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 180_000, // reasoning models can take a while on long generations
});

/**
 * Models.
 *
 * - PRIMARY: GPT-6 Astra, OpenAI's most capable model (used for student
 *   analysis, recommendations, footpaths and material generation).
 * - FAST: GPT-5.6 Luna, the cost-efficient tier (used for file analysis).
 *
 * Both can be overridden without a code change via environment variables,
 * e.g. OPENAI_MODEL_PRIMARY=gpt-5.6-terra to trade capability for cost.
 */
export const OPENAI_MODEL_RECOMMENDATION =
  process.env.OPENAI_MODEL_PRIMARY || "gpt-6-astra";
export const OPENAI_MODEL_ANALYSIS =
  process.env.OPENAI_MODEL_FAST || "gpt-5.6-luna";

/** Reasoning effort accepted by every model we use (GPT-6 rejects "none"). */
export type ReasoningEffort = "low" | "medium" | "high";

interface StructuredCallOptions {
  model: string;
  instructions: string;
  input: string;
  tool: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
  effort?: ReasoningEffort;
  maxOutputTokens?: number;
}

/**
 * Ask the model for structured data by forcing a single function tool call and
 * parsing its JSON arguments. Returns null if the model did not call the tool.
 */
export async function callStructured<T>(
  options: StructuredCallOptions
): Promise<T | null> {
  const { model, instructions, input, tool, effort = "low", maxOutputTokens } =
    options;

  const functionTool: FunctionTool = {
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    strict: false,
  };

  const response = await openai.responses.create({
    model,
    instructions,
    input,
    tools: [functionTool],
    tool_choice: { type: "function", name: tool.name },
    reasoning: { effort },
    max_output_tokens: maxOutputTokens,
  });

  assertCompleted(response);

  const call = response.output.find(
    (item) => item.type === "function_call" && item.name === tool.name
  );

  if (!call || call.type !== "function_call" || !call.arguments) {
    return null;
  }

  return JSON.parse(call.arguments) as T;
}

interface TextCallOptions {
  model: string;
  instructions: string;
  input: string;
  effort?: ReasoningEffort;
  maxOutputTokens?: number;
}

/** Ask the model for free-form text and return `output_text`. */
export async function generateText(options: TextCallOptions): Promise<string> {
  const { model, instructions, input, effort = "low", maxOutputTokens } =
    options;

  const response = await openai.responses.create({
    model,
    instructions,
    input,
    reasoning: { effort },
    max_output_tokens: maxOutputTokens,
  });

  assertCompleted(response);

  return response.output_text ?? "";
}

/** Throw a descriptive error when a response did not finish normally. */
export function assertCompleted(response: OpenAIResponse): void {
  if (response.status === "failed") {
    throw new Error(
      `OpenAI response failed: ${response.error?.message || "Unknown error"}`
    );
  }
  if (response.status === "incomplete") {
    throw new Error(
      `OpenAI response incomplete: ${
        response.incomplete_details?.reason || "unknown reason"
      }`
    );
  }
}

export interface GeneratedMaterial {
  title: string;
  content: string;
  metadata: {
    topic: string;
    level: string;
    skill: string;
    language: string;
    estimatedDuration: string;
  };
}

export interface AIAnalysisResult {
  title?: string; // AI-suggested title (optional for backward compatibility)
  description: string;
  topic: string;
  level: string;
  type: string;
  skill: string;
  tags: string[];
}

export async function analyzeFileWithAI(
  fileContent: string,
  fileName: string,
  mimeType: string
): Promise<AIAnalysisResult> {
  try {
    const prompt = `
Analyze this educational material and provide structured information about it.

File: ${fileName}
Type: ${mimeType}

Content:
${fileContent.substring(0, 4000)} ${
      fileContent.length > 4000 ? "...(truncated)" : ""
    }

Please analyze the content and provide the following information:
1. A clear, concise title for this material (max 10 words)
2. A clear description of what this material contains
3. The main topic/subject area
4. The appropriate grade level
5. The type of material (worksheet, quiz, reading, etc.)
6. The primary skill being targeted
7. Relevant tags for categorization
`;

    const result = await callStructured<AIAnalysisResult>({
      model: OPENAI_MODEL_ANALYSIS,
      instructions:
        "You are an educational content analyst. Analyze learning materials and provide structured information to help teachers categorize and use them effectively.",
      input: prompt,
      effort: "low",
      tool: {
        name: "analyze_educational_material",
        description: "Analyze educational material and return structured data",
        parameters: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description:
                "A clear, concise title for the material (max 10 words)",
            },
            description: {
              type: "string",
              description:
                "A clear, concise description of the material content and its educational purpose (2-3 sentences)",
            },
            topic: {
              type: "string",
              description: "The main subject area",
              enum: [
                "Mathematics",
                "Science",
                "English Language Arts",
                "Social Studies",
                "History",
                "Geography",
                "Art",
                "Music",
                "Physical Education",
                "Computer Science",
                "Foreign Language",
                "Life Skills",
                "Other",
              ],
            },
            level: {
              type: "array",
              items: {
                type: "string",
                enum: [
                  "Preschool",
                  "Kindergarten",
                  "Elementary (1-3)",
                  "Elementary (4-5)",
                  "Middle School (6-8)",
                  "High School (9-12)",
                  "Adult Education",
                  "Mixed Levels",
                  "A1.1 (Beginner Low)",
                  "A1.2 (Beginner High)",
                  "A2.1 (Elementary Low)",
                  "A2.2 (Elementary High)",
                  "B1.1 (Intermediate Low)",
                  "B1.2 (Intermediate High)",
                  "B2.1 (Upper-Intermediate Low)",
                  "B2.2 (Upper-Intermediate High)",
                  "C1.1 (Advanced Low)",
                  "C1.2 (Advanced High)",
                  "C2 (Proficient/Mastery)",
                ],
              },
              description: "Appropriate difficulty levels for this student",
            },
            type: {
              type: "string",
              description: "The type of educational material",
              enum: [
                "Worksheet",
                "Quiz/Test",
                "Reading Material",
                "Activity Guide",
                "Presentation",
                "Video/Audio",
                "Interactive Content",
                "Reference Material",
                "Assessment Tool",
                "Other",
              ],
            },
            skill: {
              type: "string",
              description: "The primary learning skill being targeted",
              enum: [
                "Reading Comprehension",
                "Writing",
                "Math Problem Solving",
                "Critical Thinking",
                "Vocabulary",
                "Grammar",
                "Listening",
                "Speaking",
                "Research Skills",
                "Creative Expression",
                "Scientific Method",
                "Analysis",
                "Memory",
                "Other",
              ],
            },
            tags: {
              type: "array",
              items: {
                type: "string",
              },
              description: "3-5 relevant tags for categorization and search",
            },
          },
          required: [
            "title",
            "description",
            "topic",
            "level",
            "type",
            "skill",
            "tags",
          ],
        },
      },
    });

    if (result) {
      return result;
    }

    // Fallback if the tool call is missing
    return {
      title: undefined,
      description:
        "Unable to analyze the content automatically. Please provide a description.",
      topic: "Other",
      level: "Mixed Levels",
      type: "Other",
      skill: "Other",
      tags: [],
    };
  } catch (error) {
    console.error("Error analyzing file with AI:", error);
    throw new Error("Failed to analyze file with AI");
  }
}

// Keep the old function for backward compatibility
export async function generateFileSummary(
  fileContent: string,
  fileName: string,
  mimeType: string
): Promise<string> {
  const analysis = await analyzeFileWithAI(fileContent, fileName, mimeType);
  return analysis.description;
}

export async function extractTextFromFile(file: File): Promise<string> {
  const mimeType = file.type;
  const fileName = file.name.toLowerCase();

  try {
    // For text files, read directly
    if (mimeType.startsWith("text/")) {
      return await file.text();
    }

    // For PDF files
    if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
      try {
        // Skip PDF parsing for now to avoid server-side import issues
        // TODO: Implement proper server-side PDF parsing
        return `PDF File: ${file.name}\nSize: ${file.size} bytes\nType: ${mimeType}\n\nPDF text extraction is temporarily disabled due to server compatibility issues. Please provide a manual description for AI analysis.`;
      } catch (pdfError) {
        console.warn("PDF extraction failed:", pdfError);
        return `PDF File: ${file.name}\nSize: ${file.size} bytes\n\nPDF text extraction failed. Please provide a manual description for better AI analysis.`;
      }
    }

    // For DOCX files
    if (
      mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileName.endsWith(".docx")
    ) {
      try {
        const mammoth = await import("mammoth");
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        return result.value || "DOCX content could not be extracted";
      } catch (docxError) {
        console.warn("DOCX extraction failed:", docxError);
        return `DOCX File: ${file.name}\nSize: ${file.size} bytes\n\nDOCX text extraction failed. Please provide a manual description for better AI analysis.`;
      }
    }

    // For DOC files (older format)
    if (mimeType === "application/msword" || fileName.endsWith(".doc")) {
      return `DOC File: ${file.name}\nSize: ${file.size} bytes\nType: ${mimeType}\n\nDOC files require conversion to DOCX for text extraction. Please convert to DOCX or provide a manual description.`;
    }

    // For other supported formats, provide helpful feedback
    if (fileName.endsWith(".rtf")) {
      return `RTF File: ${file.name}\nSize: ${file.size} bytes\n\nRTF files are not yet supported for text extraction. Please convert to TXT or DOCX, or provide a manual description.`;
    }

    // Fallback for unsupported file types
    return `File: ${file.name}\nSize: ${file.size} bytes\nType: ${mimeType}\n\nThis file type is not supported for automatic text extraction. Please add a manual description for AI analysis.\n\nSupported formats: TXT, PDF, DOCX`;
  } catch (error) {
    console.error("File extraction error:", error);
    return `File: ${file.name}\nSize: ${file.size} bytes\nType: ${mimeType}\n\nAn error occurred during file processing. Please provide a manual description for AI analysis.`;
  }
}

export interface AIRecommendationResult {
  materialId: string;
  reason: string;
  confidence: number;
}

const RECOMMENDATION_LIST_SCHEMA = {
  type: "object",
  properties: {
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          materialId: {
            type: "string",
            description: "The ID of the recommended material",
          },
          reason: {
            type: "string",
            description:
              "Detailed explanation of why this material is recommended for the student's specific needs (2-3 sentences)",
          },
          confidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
            description: "Confidence level of this recommendation (0-1)",
          },
        },
        required: ["materialId", "reason", "confidence"],
      },
      description:
        "List of recommended materials with detailed explanations, ordered by relevance",
    },
  },
  required: ["recommendations"],
};

export async function generateRecommendations(
  studentReport: string,
  studentName: string,
  availableMaterials: Array<{
    id: string;
    title: string;
    description?: string;
    topic: string;
    level: string;
    type: string;
    skill: string;
    tags: string[];
  }>
): Promise<AIRecommendationResult[]> {
  try {
    const prompt = `
Based on this student's latest progress report, recommend appropriate learning materials from the available options.

Student: ${studentName}
Latest Report: ${studentReport}

Available Materials:
${availableMaterials
  .map(
    (m) => `
ID: ${m.id}
Title: ${m.title}
Description: ${m.description || "No description"}
Topic: ${m.topic}
Level: ${m.level}
Type: ${m.type}
Skill: ${m.skill}
Tags: ${m.tags.join(", ")}
`
  )
  .join("\n---\n")}

Please recommend the most suitable materials for this student based on their progress report, learning needs, and areas for improvement.
`;

    const result = await callStructured<{
      recommendations: AIRecommendationResult[];
    }>({
      model: OPENAI_MODEL_ANALYSIS,
      instructions:
        "You are an educational specialist who recommends learning materials based on student progress reports. Focus on addressing learning gaps and reinforcing strengths.",
      input: prompt,
      effort: "low",
      tool: {
        name: "recommend_materials",
        description:
          "Recommend learning materials for a student based on their progress report",
        parameters: RECOMMENDATION_LIST_SCHEMA,
      },
    });

    return result?.recommendations ?? [];
  } catch (error) {
    console.error("Error generating recommendations:", error);
    throw new Error("Failed to generate recommendations");
  }
}

export interface StudentNeedsAnalysis {
  topic: string[];
  level: string[];
  type: string[];
  skill: string[];
  tags: string[];
  reasoning: string;
}

export interface StudentContext {
  name: string;
  language: string;
  grade: string | null;
  age: number | null;
  learningBarriers: string[];
  reportMetadata: Array<{
    title: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
}

export async function analyzeStudentNeeds(
  studentReports: string[],
  studentContext: StudentContext
): Promise<StudentNeedsAnalysis> {
  try {
    const reportsText = studentReports.join("\n\n---\n\n");
    const reportTitles = studentContext.reportMetadata
      .map((r) => r.title)
      .join(", ");
    const barriers = studentContext.learningBarriers.join(", ");

    const prompt = `
Analyze these student progress reports to determine what types of learning materials would be most beneficial.

Student Profile:
- Name: ${studentContext.name}
- Language: ${studentContext.language}
- Grade: ${studentContext.grade || "Not specified"}
- Age: ${studentContext.age || "Not specified"}
- Learning Barriers: ${barriers || "None specified"}
- Recent Report Titles: ${reportTitles}

Progress Reports:
${reportsText}

Consider the student's language (${
      studentContext.language
    }) when making recommendations. Pay special attention to any learning barriers (${barriers}) and how materials can accommodate these needs.

Based on these reports and student context, identify the student's learning needs and recommend what types of materials would help them most, prioritizing materials that:
1. Match their language preference (${studentContext.language})
2. Accommodate their learning barriers
3. Are appropriate for their grade/age level
`;

    const result = await callStructured<StudentNeedsAnalysis>({
      model: OPENAI_MODEL_RECOMMENDATION,
      instructions:
        "You are an educational specialist analyzing student progress reports to identify learning needs and recommend appropriate material types. You have expertise in multilingual education and learning accessibility. Always consider language compatibility, cultural relevance, and learning barrier accommodations when making recommendations.",
      input: prompt,
      effort: "low",
      tool: {
        name: "analyze_student_needs",
        description: "Analyze student reports and recommend material criteria",
        parameters: {
          type: "object",
          properties: {
            topic: {
              type: "array",
              items: {
                type: "string",
                enum: [
                  "Daily Life",
                  "Travel",
                  "Food & Drink",
                  "Work & Professions",
                  "Education",
                  "Health & Wellness",
                  "Environment",
                  "Technology",
                  "Culture & Traditions",
                  "Sports & Hobbies",
                  "Shopping",
                  "Relationships",
                  "Holidays & Celebrations",
                  "News & Current Events",
                ],
              },
              description:
                "Topics that would benefit this student (1-3 most relevant)",
            },
            level: {
              type: "array",
              items: {
                type: "string",
                enum: [
                  "A1.1 (Beginner Low)",
                  "A1.2 (Beginner High)",
                  "A2.1 (Elementary Low)",
                  "A2.2 (Elementary High)",
                  "B1.1 (Intermediate Low)",
                  "B1.2 (Intermediate High)",
                  "B2.1 (Upper-Intermediate Low)",
                  "B2.2 (Upper-Intermediate High)",
                  "C1.1 (Advanced Low)",
                  "C1.2 (Advanced High)",
                  "C2 (Proficient/Mastery)",
                ],
              },
              description: "Appropriate difficulty levels for this student",
            },
            type: {
              type: "array",
              items: {
                type: "string",
                enum: [
                  "Worksheet",
                  "Quiz",
                  "Test",
                  "Multiple Choice",
                  "True/False",
                  "Fill in the Blank",
                  "Essay Questions",
                  "Summary",
                  "Reading Passage",
                  "Exercise",
                  "Activity",
                  "Project",
                  "Assessment",
                  "Homework",
                  "Study Guide",
                  "Reference Material",
                  "Presentation",
                  "Interactive Content",
                ],
              },
              description: "Types of materials that would be most effective",
            },
            skill: {
              type: "array",
              items: {
                type: "string",
                enum: [
                  "Speaking",
                  "Listening",
                  "Reading",
                  "Writing",
                  "Grammar",
                  "Vocabulary",
                  "Pronunciation",
                  "Intercultural Communication",
                ],
              },
              description: "Skills this student needs to develop or practice",
            },
            tags: {
              type: "array",
              items: {
                type: "string",
              },
              description:
                "Additional relevant tags or keywords for material search",
            },
            reasoning: {
              type: "string",
              description:
                "Brief explanation of why these recommendations are appropriate for this student",
            },
          },
          required: ["topic", "level", "type", "skill", "tags", "reasoning"],
        },
      },
    });

    console.log("AI analyzeStudentNeeds result:", result);

    if (result) {
      return result;
    }

    // Fallback if the tool call is missing
    return {
      topic: ["Other"],
      level: ["Mixed Levels"],
      type: ["Other"],
      skill: ["Other"],
      tags: [],
      reasoning: "Unable to analyze student needs automatically.",
    };
  } catch (error) {
    console.error("Error analyzing student needs:", error);
    throw new Error("Failed to analyze student needs");
  }
}

interface CrossLanguageGuidance {
  message: string;
  availableLanguages: string[];
  mitigation: string;
}

export async function generateRecommendationsFromFiltered(
  studentContext: StudentContext,
  studentNeeds: StudentNeedsAnalysis,
  filteredMaterials: Array<{
    id: string;
    title: string;
    description?: string;
    topic: string;
    level: string;
    type: string;
    skill: string;
    tags: string[];
    language?: string;
    preScore?: number;
    scoreRationale?: string;
    aiSummary?: string | null;
  }>,
  crossLanguageGuidance?: CrossLanguageGuidance | null
): Promise<AIRecommendationResult[]> {
  try {
    const barriers = studentContext.learningBarriers.join(", ") || "None";
    const languageContext = crossLanguageGuidance
      ? `\n\nIMPORTANT: ${
          crossLanguageGuidance.message
        }\nAvailable languages: ${crossLanguageGuidance.availableLanguages.join(
          ", "
        )}\nMitigation strategy: ${crossLanguageGuidance.mitigation}`
      : `\nStudent's preferred language: ${studentContext.language}`;

    // Extract key insights from student needs reasoning
    const needsHighlights = studentNeeds.reasoning
      .split(".")
      .slice(0, 3)
      .join(". ");

    const prompt = `
Based on the student's analyzed learning needs, recommend the most suitable materials from the filtered options.

Student Profile:
- Name: ${studentContext.name}
- Language: ${studentContext.language}
- Grade: ${studentContext.grade || "Not specified"}
- Age: ${studentContext.age || "Not specified"}
- Learning Barriers: ${barriers}
${languageContext}

Learning Needs Analysis: ${studentNeeds.reasoning}

KEY PRIORITIES: ${needsHighlights}

Recommended criteria:
- Topics: ${studentNeeds.topic.join(", ")}
- Levels: ${studentNeeds.level.join(", ")}
- Types: ${studentNeeds.type.join(", ")}
- Skills: ${studentNeeds.skill.join(", ")}
- Tags: ${studentNeeds.tags.join(", ")}

Available Materials (pre-scored and filtered):
${filteredMaterials
  .map(
    (m) => `
ID: ${m.id}
Title: ${m.title}
Description: ${m.description || "No description"}
AI Analysis: ${m.aiSummary || "Not available"}
Topic: ${m.topic}
Level: ${m.level}
Type: ${m.type}
Skill: ${m.skill}
Language: ${m.language || "Not specified"}
Pre-Score: ${m.preScore || 0}/100
Score Rationale: ${m.scoreRationale || "No scoring data"}
Tags: ${m.tags.join(", ")}
`
  )
  .join("\n---\n")}

Please rank and recommend the most suitable materials for this student, focusing on:

1. **CRITICAL PRIORITY: Proficiency Level** - NEVER recommend materials above the student's current level (${
      studentNeeds.level.join(", ")
    }). Materials at or slightly below the student's level are ideal. Learning barriers should NOT justify recommending advanced materials.
2. Language alignment - Prioritize materials in the student's preferred language (${
      studentContext.language
    })
3. Topic and skill match - Materials that address the identified learning needs
4. Learning barrier accommodations - Consider materials that address specific learning barriers: ${barriers}, but ONLY if they are at an appropriate level
5. Pre-scoring context - Use the pre-scores as a starting point, but apply your expertise to refine recommendations
6. Cultural relevance - Consider if materials are culturally appropriate and engaging

IMPORTANT: Recommend between 3-20 materials to give the teacher a good variety of options to choose from. Include materials at slightly different difficulty levels WITHIN the appropriate range (at or below student level), or approaching the topic from different angles.

When recommending cross-language materials, provide specific adaptation strategies in your reasoning.
`;

    const result = await callStructured<{
      recommendations: AIRecommendationResult[];
    }>({
      model: OPENAI_MODEL_RECOMMENDATION,
      instructions:
        "You are an educational specialist who recommends learning materials based on detailed student needs analysis. You have expertise in multilingual education, learning accessibility, and cultural competency. Consider language compatibility, learning barrier accommodations, and cultural relevance when making recommendations. Always explain how materials can be adapted for cross-language use when necessary.",
      input: prompt,
      effort: "low",
      tool: {
        name: "recommend_filtered_materials",
        description:
          "Recommend the best materials from the filtered set for the student",
        parameters: RECOMMENDATION_LIST_SCHEMA,
      },
    });

    return result?.recommendations ?? [];
  } catch (error) {
    console.error(
      "Error generating recommendations from filtered materials:",
      error
    );

    // Enhanced error logging
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    }

    // Log OpenAI-specific errors
    if (typeof error === "object" && error !== null && "error" in error) {
      const openaiError = error as {
        error: { message?: string; type?: string; code?: string };
      };
      console.error("OpenAI API error:", openaiError.error);
    }

    throw new Error(
      `Failed to generate recommendations from filtered materials: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Generate actual learning material content for a specific student
 * based on their profile, reports, and identified needs
 */
export async function generateMaterialForStudent(
  studentNeeds: StudentNeedsAnalysis,
  studentProfile: {
    name: string;
    language: string;
    grade?: string | null;
    age?: number | null;
    learningBarriers: string[];
  },
  recentReports: Array<{ title: string; excerpt: string }>
): Promise<GeneratedMaterial> {
  try {
    const prompt = `
You are an expert educational content creator. Generate a complete, ready-to-use learning material for a specific student.

Student Profile:
- Name: ${studentProfile.name}
- Language: ${studentProfile.language}
- Grade: ${studentProfile.grade || "Not specified"}
- Age: ${studentProfile.age || "Not specified"}
- Learning Barriers: ${
      studentProfile.learningBarriers.length > 0
        ? studentProfile.learningBarriers.join(", ")
        : "None"
    }

Recent Progress Reports Summary:
${recentReports.map((r, i) => `${i + 1}. ${r.title}: ${r.excerpt}`).join("\n")}

AI-Identified Learning Needs:
- Topics: ${studentNeeds.topic.join(", ")}
- Levels: ${studentNeeds.level.join(", ")}
- Skills: ${studentNeeds.skill.join(", ")}
- Material Types: ${studentNeeds.type.join(", ")}
- Analysis: ${studentNeeds.reasoning}

Please generate a complete learning material that:
1. Is appropriate for the student's level and needs
2. Addresses the identified learning gaps
3. Is engaging and suitable for their age/grade
4. Takes into account any learning barriers
5. Is in ${studentProfile.language} language
6. Includes clear instructions for both teacher and student
7. Has exercises, activities, or content that can be completed

Format the material as a structured document with:
- A clear title
- Learning objectives
- Instructions
- Main content/activities
- Assessment or reflection questions (if applicable)

Generate the complete material now:
`;

    const generatedContent = await generateText({
      model: OPENAI_MODEL_RECOMMENDATION,
      instructions:
        "You are an expert educational content creator specializing in personalized learning materials. Generate complete, ready-to-use materials that teachers can immediately use with their students. Be thorough, engaging, and pedagogically sound.",
      input: prompt,
      effort: "medium",
      maxOutputTokens: 6000,
    });

    if (!generatedContent) {
      throw new Error("No content generated from AI");
    }

    // Extract title from the generated content (first line typically)
    const lines = generatedContent.split("\n");
    const titleLine =
      lines.find((line) => line.trim().length > 0) || "Learning Material";
    const title = titleLine
      .replace(/^#+\s*/, "")
      .replace(/^\*\*/, "")
      .replace(/\*\*$/, "")
      .trim();

    return {
      title,
      content: generatedContent,
      metadata: {
        topic: studentNeeds.topic[0] || "General",
        level: studentNeeds.level[0] || "Mixed",
        skill: studentNeeds.skill[0] || "Multiple Skills",
        language: studentProfile.language,
        estimatedDuration: "30-45 minutes",
      },
    };
  } catch (error) {
    console.error("Error generating material for student:", error);
    throw new Error("Failed to generate learning material");
  }
}

// ---------------------------------------------------------------------------
// Lesson footpath
// ---------------------------------------------------------------------------

export interface FootpathStage {
  title: string;
  goal: string;
  focusAreas: string[];
  activities: string[];
  successIndicators: string[];
  estimatedDuration: string;
}

export interface LearningFootpath {
  summary: string;
  teachingApproach: string;
  stages: FootpathStage[];
  accommodations: string[];
  motivationTips: string[];
  watchOuts: string[];
}

export interface FootpathStudentInput {
  name: string;
  language: string;
  grade: string | null;
  age: number | null;
  learningBarriers: string[];
  notes: string | null;
  reports: Array<{ title: string; content: string; createdAt: Date }>;
}

/**
 * Read the whole student persona (profile, teacher notes and progress reports)
 * and produce a personalized, staged teaching plan for the teacher.
 */
export async function generateLearningFootpath(
  student: FootpathStudentInput
): Promise<LearningFootpath> {
  const barriers =
    student.learningBarriers.length > 0
      ? student.learningBarriers.join(", ")
      : "None specified";

  const reportsText =
    student.reports.length > 0
      ? student.reports
          .map(
            (r, i) =>
              `${i + 1}. ${r.title} (${r.createdAt.toLocaleDateString(
                "en-GB"
              )})\n${r.content}`
          )
          .join("\n\n")
      : "No progress reports yet.";

  const prompt = `
Build a personalized lesson footpath for the teacher of this student. A footpath is a staged, practical plan describing HOW to approach teaching this specific learner over the coming weeks, not a list of materials.

Student Profile:
- Name: ${student.name}
- Language being learned: ${student.language}
- Grade: ${student.grade || "Not specified"}
- Age: ${student.age || "Not specified"}
- Learning Barriers: ${barriers}

Teacher Notes:
${student.notes?.trim() || "No notes yet."}

Progress Reports (newest first):
${reportsText}

Requirements:
1. Synthesize the persona: strengths, gaps, interests, motivation patterns, and how the learning barriers show up in practice.
2. Recommend an overall teaching approach (pace, interaction style, feedback style, scaffolding) tailored to this student.
3. Lay out 3-5 sequential stages. Each stage must have a concrete goal, the skills/topics it targets, 3-5 practical classroom activities in ${
    student.language
  } teaching context, observable success indicators that tell the teacher when to move on, and a rough duration.
4. List specific accommodations for the learning barriers (or general accessibility tips if none are listed).
5. Give motivation tips that build on the student's interests, and "watch-outs": early warning signs and what to do about them.
6. Keep every item actionable and specific to this student. Avoid generic advice. Write in English for the teacher.
`;

  const result = await callStructured<LearningFootpath>({
    model: OPENAI_MODEL_RECOMMENDATION,
    instructions:
      "You are an experienced language-teaching coach and special-education specialist. You design individualized teaching plans for teachers based on a student's persona: their profile, teacher notes and progress reports. You are concrete, pedagogically sound, and sensitive to learning barriers and motivation.",
    input: prompt,
    effort: "medium",
    maxOutputTokens: 6000,
    tool: {
      name: "create_lesson_footpath",
      description:
        "Return a staged, personalized teaching plan for this student",
      parameters: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description:
              "2-4 sentence synthesis of the student's persona: strengths, gaps, interests and how barriers show up",
          },
          teachingApproach: {
            type: "string",
            description:
              "How the teacher should approach this student overall: pace, interaction style, feedback, scaffolding (1 short paragraph)",
          },
          stages: {
            type: "array",
            minItems: 3,
            maxItems: 5,
            description: "Sequential stages of the footpath",
            items: {
              type: "object",
              properties: {
                title: {
                  type: "string",
                  description: "Short stage name",
                },
                goal: {
                  type: "string",
                  description: "What the student should achieve in this stage",
                },
                focusAreas: {
                  type: "array",
                  items: { type: "string" },
                  description: "Skills or topics targeted in this stage",
                },
                activities: {
                  type: "array",
                  items: { type: "string" },
                  description:
                    "3-5 concrete classroom activities the teacher can run",
                },
                successIndicators: {
                  type: "array",
                  items: { type: "string" },
                  description:
                    "Observable signs the stage is complete and the teacher can move on",
                },
                estimatedDuration: {
                  type: "string",
                  description: "Rough duration, e.g. '2-3 weeks'",
                },
              },
              required: [
                "title",
                "goal",
                "focusAreas",
                "activities",
                "successIndicators",
                "estimatedDuration",
              ],
            },
          },
          accommodations: {
            type: "array",
            items: { type: "string" },
            description:
              "Specific accommodations for the student's learning barriers",
          },
          motivationTips: {
            type: "array",
            items: { type: "string" },
            description: "Ways to keep this student engaged",
          },
          watchOuts: {
            type: "array",
            items: { type: "string" },
            description:
              "Early warning signs to monitor and how to respond to them",
          },
        },
        required: [
          "summary",
          "teachingApproach",
          "stages",
          "accommodations",
          "motivationTips",
          "watchOuts",
        ],
      },
    },
  });

  if (!result || !Array.isArray(result.stages) || result.stages.length === 0) {
    throw new Error("The AI did not return a usable footpath");
  }

  return result;
}
