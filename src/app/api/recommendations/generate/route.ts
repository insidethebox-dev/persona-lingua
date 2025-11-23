import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  analyzeStudentNeeds,
  generateRecommendationsFromFiltered,
} from "@/lib/openai";
import {
  scoreEnhancedMaterialMatch,
  extractKeyConceptsFromReports,
} from "@/lib/recommendation-scoring";
import { ApiResponse } from "@/types";

export async function POST(request: NextRequest) {
  try {
    // Two-step AI recommendation process:
    // 1. Analyze student reports to determine learning needs and criteria
    // 2. Filter materials based on criteria, then use AI to recommend the best matches

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
          take: 5, // Get recent reports for better analysis
          select: {
            id: true,
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
        { success: false, error: "No reports found for this student" },
        { status: 400 }
      );
    }

    // Step 1: Analyze student needs using AI - now with enhanced student data
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

    const studentNeeds = await analyzeStudentNeeds(
      reportContents,
      studentContext
    );

    // Step 2: Filter materials based on AI-determined criteria
    // Only include materials from the same school as the teacher
    const allMaterials = await prisma.learningMaterial.findMany({
      where: {
        schoolId: teacher.schoolId, // Only materials from the same school
      },
      select: {
        id: true,
        title: true,
        description: true,
        topic: true,
        level: true,
        type: true,
        skill: true,
        tags: true,
        language: true, // Include language for matching
        aiSummary: true, // Include AI summary for better analysis
      },
    });

    if (allMaterials.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No learning materials available for recommendations",
        },
        { status: 400 }
      );
    }

    // Extract key concepts from student reports for semantic matching
    const studentReportsConcepts =
      extractKeyConceptsFromReports(reportContents);

    // Score materials using enhanced scoring with semantic matching
    interface ScoredMaterial {
      material: (typeof allMaterials)[0];
      score: number;
      scoreBreakdown: {
        languageMatch: number;
        topicMatch: number;
        levelMatch: number;
        typeMatch: number;
        skillMatch: number;
        tagMatch: number;
        accessibilityMatch: number;
        semanticMatch: number;
      };
      rationale: string[];
    }

    const scoredMaterials: ScoredMaterial[] = allMaterials.map((material) => {
      const scoringResult = scoreEnhancedMaterialMatch({
        material,
        studentNeeds,
        studentContext: {
          language: student.language,
          learningBarriers: student.learningBarriers,
        },
        studentReportsConcepts,
      });

      return {
        material,
        score: scoringResult.score,
        scoreBreakdown: scoringResult.breakdown,
        rationale: scoringResult.rationale,
      };
    });

    // Sort by score and take top materials (limit to reasonable number for AI analysis)
    const MAX_MATERIALS_FOR_AI = 20;
    const topScoredMaterials = scoredMaterials
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_MATERIALS_FOR_AI);

    // Count how many materials were filtered out due to language mismatch
    const languageMismatchCount = scoredMaterials.filter(
      (m) => m.score < 0
    ).length;
    console.log(
      `Language filtering: ${languageMismatchCount} materials excluded (wrong language), ${
        scoredMaterials.length - languageMismatchCount
      } materials in ${student.language}`
    );

    if (topScoredMaterials.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No materials scored above threshold",
        },
        { status: 400 }
      );
    }

    // Filter to only materials with positive scores for AI analysis
    const filteredMaterials = topScoredMaterials
      .filter((scored) => scored.score > 0)
      .map((scored) => scored.material);

    // Check if we have same-language materials
    const sameLanguageMaterials = topScoredMaterials.filter(
      (scored) => scored.material.language === student.language
    );

    let crossLanguageGuidance = null;

    if (sameLanguageMaterials.length === 0 && filteredMaterials.length > 0) {
      // No same-language materials available - provide guidance
      crossLanguageGuidance = {
        message: `No materials available in ${student.language}. Showing best alternatives with adaptation guidance.`,
        availableLanguages: [
          ...new Set(
            topScoredMaterials.map((scored) => scored.material.language)
          ),
        ].filter(Boolean),
        mitigation: `Consider translating key concepts, using visual aids, or pairing with ${student.language} resources.`,
      };
    }

    if (filteredMaterials.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No materials match the student's learning needs",
          crossLanguageGuidance,
        },
        { status: 400 }
      );
    }

    // Write scored materials to file for debugging
    const fs = await import("fs");
    const path = await import("path");
    const debugDir = path.join(process.cwd(), "debug-logs");

    // Create debug directory if it doesn't exist
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const debugFilePath = path.join(
      debugDir,
      `scored-materials-${timestamp}.json`
    );

    fs.writeFileSync(
      debugFilePath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          studentId,
          studentName: student.name,
          studentLanguage: student.language,
          totalMaterials: allMaterials.length,
          scoredMaterials: scoredMaterials,
          topScoredMaterials: topScoredMaterials,
        },
        null,
        2
      )
    );

    console.log(`Scored materials written to: ${debugFilePath}`);

    // Step 3: Use AI to recommend the best materials from the filtered set
    // Prepare data for AI analysis with scoring context
    const materialsForAI = topScoredMaterials.map((scoredMaterial) => ({
      ...scoredMaterial.material,
      description:
        scoredMaterial.material.description ||
        scoredMaterial.material.aiSummary ||
        undefined,
      topic: scoredMaterial.material.topic || "general", // Ensure topic is never null
      preScore: scoredMaterial.score,
      scoreRationale: scoredMaterial.rationale.join("; "),
      aiSummary: scoredMaterial.material.aiSummary, // Include AI analysis for better context
    }));

    const aiRecommendations = await generateRecommendationsFromFiltered(
      studentContext,
      studentNeeds,
      materialsForAI,
      crossLanguageGuidance
    );

    // Limit to top N recommendations (AI returns them ordered by confidence)
    const MAX_RECOMMENDATIONS = 20; // Change this number to control how many recommendations are shown
    const limitedRecommendations = aiRecommendations.slice(
      0,
      MAX_RECOMMENDATIONS
    );

    // Clear existing recommendations for this student
    await prisma.recommendation.deleteMany({
      where: { studentId },
    });

    // Save new recommendations with pre-score data
    const recommendations = await Promise.all(
      limitedRecommendations.map((rec) => {
        // Find the corresponding scored material to get pre-score data
        const scoredMaterial = topScoredMaterials.find(
          (scored) => scored.material.id === rec.materialId
        );

        return prisma.recommendation.create({
          data: {
            studentId,
            learningMaterialId: rec.materialId,
            reason: rec.reason,
            confidence: rec.confidence,
            preScore: scoredMaterial?.score || 0,
            scoreRationale:
              scoredMaterial?.rationale.join("; ") || "No scoring data",
          },
        });
      })
    );

    const response: ApiResponse = {
      success: true,
      data: recommendations,
      message: `Generated ${recommendations.length} recommendations from ${filteredMaterials.length} filtered materials (${allMaterials.length} total available)`,
      metadata: {
        crossLanguageGuidance,
        languageStats: {
          studentLanguage: student.language,
          sameLanguageCount: sameLanguageMaterials.length,
          totalAvailable: allMaterials.length,
        },
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error generating recommendations:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate recommendations" },
      { status: 500 }
    );
  }
}
