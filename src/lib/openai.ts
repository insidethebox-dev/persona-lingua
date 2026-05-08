import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const OPENAI_MODEL_RECOMMENDATION = "gpt-4o";
export const OPENAI_MODEL_ANALYSIS = "gpt-4o-mini";

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

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL_ANALYSIS,
      messages: [
        {
          role: "system",
          content:
            "You are an educational content analyst. Analyze learning materials and provide structured information to help teachers categorize and use them effectively.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      functions: [
        {
          name: "analyze_educational_material",
          description:
            "Analyze educational material and return structured data",
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
      ],
      function_call: { name: "analyze_educational_material" },
      temperature: 0.3,
    });

    const functionCall = completion.choices[0]?.message?.function_call;
    if (functionCall && functionCall.arguments) {
      const result = JSON.parse(functionCall.arguments) as AIAnalysisResult;
      return result;
    }

    // Fallback if function calling fails
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

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL_ANALYSIS,
      messages: [
        {
          role: "system",
          content:
            "You are an educational specialist who recommends learning materials based on student progress reports. Focus on addressing learning gaps and reinforcing strengths.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      functions: [
        {
          name: "recommend_materials",
          description:
            "Recommend learning materials for a student based on their progress report",
          parameters: {
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
                        "Why this material is recommended for the student (2-3 sentences)",
                    },
                    confidence: {
                      type: "number",
                      minimum: 0,
                      maximum: 1,
                      description:
                        "Confidence level of this recommendation (0-1)",
                    },
                  },
                  required: ["materialId", "reason", "confidence"],
                },
                description: "List of recommended materials with explanations",
              },
            },
            required: ["recommendations"],
          },
        },
      ],
      function_call: { name: "recommend_materials" },
      temperature: 0.4,
    });

    const functionCall = completion.choices[0]?.message?.function_call;
    if (functionCall && functionCall.arguments) {
      const result = JSON.parse(functionCall.arguments);
      return result.recommendations as AIRecommendationResult[];
    }

    return [];
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

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL_RECOMMENDATION,
      messages: [
        {
          role: "system",
          content:
            "You are an educational specialist analyzing student progress reports to identify learning needs and recommend appropriate material types. You have expertise in multilingual education and learning accessibility. Always consider language compatibility, cultural relevance, and learning barrier accommodations when making recommendations.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      functions: [
        {
          name: "analyze_student_needs",
          description:
            "Analyze student reports and recommend material criteria",
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
      ],
      function_call: { name: "analyze_student_needs" },
      temperature: 0.3,
    });

    console.log(
      "AI analyzeStudentNeeds completion:",
      completion.choices[0]?.message
    );

    const functionCall = completion.choices[0]?.message?.function_call;
    if (functionCall && functionCall.arguments) {
      const result = JSON.parse(functionCall.arguments) as StudentNeedsAnalysis;
      return result;
    }

    // Fallback if function calling fails
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

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL_RECOMMENDATION,
      messages: [
        {
          role: "system",
          content:
            "You are an educational specialist who recommends learning materials based on detailed student needs analysis. You have expertise in multilingual education, learning accessibility, and cultural competency. Consider language compatibility, learning barrier accommodations, and cultural relevance when making recommendations. Always explain how materials can be adapted for cross-language use when necessary.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.4, // Lower temperature for more consistent recommendations
      functions: [
        {
          name: "recommend_filtered_materials",
          description:
            "Recommend the best materials from the filtered set for the student",
          parameters: {
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
                      description:
                        "Confidence level of this recommendation (0-1)",
                    },
                  },
                  required: ["materialId", "reason", "confidence"],
                },
                description:
                  "List of recommended materials with detailed explanations, ordered by relevance",
              },
            },
            required: ["recommendations"],
          },
        },
      ],
      function_call: { name: "recommend_filtered_materials" },
    });

    const functionCall = completion.choices[0]?.message?.function_call;
    if (functionCall && functionCall.arguments) {
      const result = JSON.parse(functionCall.arguments);
      return result.recommendations as AIRecommendationResult[];
    }

    return [];
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
    if (typeof error === 'object' && error !== null && 'error' in error) {
      const openaiError = error as { error: { message?: string; type?: string; code?: string } };
      console.error("OpenAI API error:", openaiError.error);
    }
    
    throw new Error(
      `Failed to generate recommendations from filtered materials: ${
        error instanceof Error ? error.message : 'Unknown error'
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
): Promise<{
  title: string;
  content: string;
  metadata: {
    topic: string;
    level: string;
    skill: string;
    language: string;
    estimatedDuration: string;
  };
}> {
  try {
    const prompt = `
You are an expert educational content creator. Generate a complete, ready-to-use learning material for a specific student.

Student Profile:
- Name: ${studentProfile.name}
- Language: ${studentProfile.language}
- Grade: ${studentProfile.grade || "Not specified"}
- Age: ${studentProfile.age || "Not specified"}
- Learning Barriers: ${studentProfile.learningBarriers.length > 0 ? studentProfile.learningBarriers.join(", ") : "None"}

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

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL_RECOMMENDATION,
      messages: [
        {
          role: "system",
          content:
            "You are an expert educational content creator specializing in personalized learning materials. Generate complete, ready-to-use materials that teachers can immediately use with their students. Be thorough, engaging, and pedagogically sound.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.8, // More creative for content generation
      max_tokens: 3000, // Allow for longer content
    });

    const generatedContent = completion.choices[0]?.message?.content;

    if (!generatedContent) {
      throw new Error("No content generated from AI");
    }

    // Extract title from the generated content (first line typically)
    const lines = generatedContent.split("\n");
    const titleLine = lines.find((line) => line.trim().length > 0) || "Learning Material";
    const title = titleLine.replace(/^#+\s*/, "").replace(/^\*\*/, "").replace(/\*\*$/, "").trim();

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
