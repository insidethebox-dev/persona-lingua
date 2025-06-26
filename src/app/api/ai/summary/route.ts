import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { analyzeFileWithAI, extractTextFromFile } from "@/lib/openai";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    // Extract text content from file
    const textContent = await extractTextFromFile(file);

    // Generate AI analysis with structured data
    const analysis = await analyzeFileWithAI(textContent, file.name, file.type);

    return NextResponse.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    console.error("Error generating AI analysis:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate AI analysis" },
      { status: 500 }
    );
  }
}
