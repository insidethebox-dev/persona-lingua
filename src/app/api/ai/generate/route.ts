import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import OpenAI from "openai";
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import { extractTextFromFile, OPENAI_MODEL_RECOMMENDATION } from "@/lib/openai";

// Reasoning models can take a while on long materials (serverless limit).
export const maxDuration = 300;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 240_000,
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const formData = await request.formData();

    // Optional output format (e.g., 'docx' or fallback to JSON)
    const output = (formData.get("output") as string) || "json";

    // Get the form data that the user has potentially modified
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const topic = formData.get("topic") as string;
    const level = formData.get("level") as string;
    const type = formData.get("type") as string;
    const skill = formData.get("skill") as string;
    const tags = formData.get("tags") as string;
    const instructions = formData.get("instructions") as string;
    const outputLanguage =
      (formData.get("outputLanguage") as string) || "English";

    // Get the uploaded file for additional context
    const file = formData.get("file") as File | null;
    let fileContent = "";

    // Extract text content from uploaded file if provided
    if (file) {
      try {
        fileContent = await extractTextFromFile(file);
        console.log(
          "Extracted file content for AI context:",
          fileContent.substring(0, 200) + "..."
        );
      } catch (error) {
        console.error("Error extracting file content:", error);
        // Continue without file content if extraction fails
      }
    }

    // Validate required fields
    if (!title || !topic || !level || !type || !skill) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing required form fields. Please ensure all required fields are filled.",
        },
        { status: 400 }
      );
    }

    // Generate a similar file based on the user's form data (possibly modified)
    const prompt = `Based on the following educational material specifications, create a new, similar learning material:

Material Specifications:
- Title: ${title}
- Topic: ${topic}
- Level: ${level}
- Type: ${type}
- Skill: ${skill}
- Description: ${description || "No description provided"}
- Tags: ${tags || "No tags provided"}

${
  fileContent
    ? `\nOriginal Material Content for Context:\n${fileContent.substring(
        0,
        3000
      )}${
        fileContent.length > 3000 ? "\n...(content truncated for length)" : ""
      }\n`
    : ""
}

${instructions ? `Special Instructions: ${instructions}` : ""}

Please create a comprehensive educational material that:
1. ${
      fileContent
        ? "Uses the uploaded material as inspiration and context, creating similar but distinct content"
        : "Covers the topic and skill level specified"
    }
2. Maintains the same educational type and difficulty level
3. Is appropriate for the target audience
4. Includes exercises, examples, or activities as relevant
5. Is well-structured and educational
${
  fileContent
    ? "6. Complements the original material while being unique and valuable"
    : "6. Is engaging and pedagogically sound"
}
${instructions ? "7. Follows the special instructions provided above" : ""}

Format the response as a complete educational document with:
- Clear title
- Introduction/overview
- Main content sections
- Examples or exercises
- Summary or conclusion

${
  fileContent
    ? "Make it complementary to the uploaded material while being different enough to serve as additional practice or extension material."
    : "Make it engaging and educational for the specified level and skill."
}

IMPORTANT: Generate the entire content in ${outputLanguage}. All text, headings, instructions, and examples must be written in ${outputLanguage}.`;

    console.log("AI Generation Prompt:", prompt);

    const response = await openai.responses.create({
      model: OPENAI_MODEL_RECOMMENDATION,
      instructions: `You are an expert educational content creator. Create high-quality, pedagogically sound learning materials that are engaging and appropriate for the specified level. You must write all content in the requested language (${outputLanguage}). If the requested language is not English, ensure all text, headings, instructions, and examples are properly translated and culturally appropriate.`,
      input: prompt,
      reasoning: { effort: "medium" },
      max_output_tokens: 6000,
    });

    if (response.status === "failed") {
      throw new Error(response.error?.message || "OpenAI response failed");
    }

    const generatedContent = response.output_text?.trim();

    if (!generatedContent) {
      return NextResponse.json(
        { success: false, error: "Failed to generate content" },
        { status: 500 }
      );
    }

    // If the caller asked for a DOCX file, build and return it
    if (output === "docx") {
      // Try to interpret the first non-empty line as a title
      const lines = generatedContent.split(/\r?\n/);
      let firstTitle = "Generated Material";
      let firstContentIndex = 0;
      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed.length > 0) {
          firstTitle = trimmed;
          firstContentIndex = i + 1;
          break;
        }
      }

      // Convert remaining text into paragraphs, preserving blank lines as spacers
      const paragraphs: Paragraph[] = [];
      paragraphs.push(
        new Paragraph({
          text: firstTitle,
          heading: HeadingLevel.TITLE,
        })
      );

      // Add a small metadata header
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Topic: ${topic}` }),
            new TextRun({ text: "  •  ", break: 0 }),
            new TextRun({ text: `Level: ${level}` }),
            new TextRun({ text: "  •  ", break: 0 }),
            new TextRun({ text: `Type: ${type}` }),
            new TextRun({ text: "  •  ", break: 0 }),
            new TextRun({ text: `Skill: ${skill}` }),
          ],
        })
      );

      // Spacer
      paragraphs.push(new Paragraph(""));

      // Add the rest of the content as simple paragraphs
      const rest = lines.slice(firstContentIndex).join("\n");
      const blocks = rest.split(/\n{2,}/); // split on blank lines
      for (const block of blocks) {
        const trimmed = block.trim();
        if (trimmed.length === 0) {
          paragraphs.push(new Paragraph(""));
          continue;
        }
        // Further split block into lines to avoid overly long runs
        const blockLines = trimmed.split(/\n/);
        for (let i = 0; i < blockLines.length; i++) {
          const l = blockLines[i].trimEnd();
          if (l.length === 0) {
            paragraphs.push(new Paragraph(""));
          } else {
            paragraphs.push(new Paragraph(l));
          }
        }
        paragraphs.push(new Paragraph(""));
      }

      const doc = new Document({
        sections: [
          {
            properties: {},
            children: paragraphs,
          },
        ],
      });

      const timestampDocx = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[:-]/g, "");
      const docxFilename = `Generated_${topic.replace(
        /\s+/g,
        "_"
      )}_${level.replace(/\s+/g, "_")}_${timestampDocx}.docx`;

      const buffer = await Packer.toBuffer(doc);
      // Convert Buffer to Uint8Array for Response compatibility
      const uint8Array = new Uint8Array(buffer);
      return new Response(uint8Array, {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${docxFilename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    // Generate a filename for the JSON/text path
    const timestamp = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:-]/g, "");
    const filename = `Generated_${topic.replace(/\s+/g, "_")}_${level.replace(
      /\s+/g,
      "_"
    )}_${timestamp}.txt`;

    return NextResponse.json({
      success: true,
      data: {
        content: generatedContent,
        filename: filename,
        analysis: {
          topic: topic,
          level: level,
          type: type,
          skill: skill,
          generatedTitle: `Generated: ${topic} - ${level} Level`,
        },
      },
    });
  } catch (error) {
    console.error("Error generating file:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
