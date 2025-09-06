import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
      model: "gpt-3.5-turbo",
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
                type: "string",
                description: "The appropriate grade/difficulty level",
                enum: [
                  "Preschool",
                  "Kindergarten",
                  "Elementary (1-3)",
                  "Elementary (4-5)",
                  "Middle School (6-8)",
                  "High School (9-12)",
                  "Adult Education",
                  "Mixed Levels",
                ],
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

  // For text files, read directly
  if (mimeType.startsWith("text/")) {
    return await file.text();
  }

  // For other file types, we'll need to implement extraction
  // For now, return basic file info
  return `File: ${file.name}\nSize: ${file.size} bytes\nType: ${mimeType}\n\nThis file requires specialized extraction. Please add a manual description for AI analysis.`;
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
      model: "gpt-3.5-turbo",
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

export async function analyzeStudentNeeds(
  studentReports: string[],
  studentName: string
): Promise<StudentNeedsAnalysis> {
  try {
    const reportsText = studentReports.join("\n\n---\n\n");
    const prompt = `
Analyze these student progress reports to determine what types of learning materials would be most beneficial.

Student: ${studentName}
Progress Reports:
${reportsText}

Based on these reports, identify the student's learning needs and recommend what types of materials would help them most.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are an educational specialist analyzing student progress reports to identify learning needs and recommend appropriate material types.",
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
                description:
                  "Topics that would benefit this student (1-3 most relevant)",
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
                description: "Types of materials that would be most effective",
              },
              skill: {
                type: "array",
                items: {
                  type: "string",
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

export async function generateRecommendationsFromFiltered(
  studentName: string,
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
  }>
): Promise<AIRecommendationResult[]> {
  try {
    const prompt = `
Based on the student's analyzed learning needs, recommend the most suitable materials from the filtered options.

Student: ${studentName}
Learning Needs Analysis: ${studentNeeds.reasoning}

Recommended criteria:
- Topics: ${studentNeeds.topic.join(", ")}
- Levels: ${studentNeeds.level.join(", ")}
- Types: ${studentNeeds.type.join(", ")}
- Skills: ${studentNeeds.skill.join(", ")}
- Tags: ${studentNeeds.tags.join(", ")}

Available Materials (pre-filtered based on criteria):
${filteredMaterials
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

Please rank and recommend the most suitable materials for this student, focusing on how well each material addresses their specific learning needs.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are an educational specialist who recommends learning materials based on detailed student needs analysis. Focus on matching materials to specific learning gaps and goals.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
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
      temperature: 0.4,
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
    throw new Error(
      "Failed to generate recommendations from filtered materials"
    );
  }
}
