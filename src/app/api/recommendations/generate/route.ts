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
  isMaterialTooAdvanced,
  evaluateTopicCoverage,
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

    console.log(`[Recommendations] Starting generation for student: ${studentId}, teacher: ${teacher.id}`);

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

    console.log(`[Recommendations] Found ${student.reports.length} reports for student ${student.name}`);

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

    console.log(`[Recommendations] Analyzing student needs with OpenAI...`);
    const studentNeeds = await analyzeStudentNeeds(
      reportContents,
      studentContext
    );
    console.log(`[Recommendations] Student needs analyzed:`, {
      topics: studentNeeds.topic,
      levels: studentNeeds.level,
      types: studentNeeds.type,
      skills: studentNeeds.skill,
    });

    // Get list of completed materials for this student
    const completedMaterials = await prisma.studentMaterialProgress.findMany({
      where: {
        studentId,
        isCompleted: true,
      },
      select: {
        learningMaterialId: true,
      },
    });

    const completedMaterialIds = completedMaterials.map(
      (progress) => progress.learningMaterialId
    );

    console.log(
      `Student ${studentId} has completed ${completedMaterialIds.length} materials`
    );

    // Step 2: Filter materials based on AI-determined criteria
    // Only include materials from the same school as the teacher
    // Exclude materials that have already been completed
    console.log(`[Recommendations] Fetching materials from school ${teacher.schoolId}...`);
    const allMaterials = await prisma.learningMaterial.findMany({
      where: {
        schoolId: teacher.schoolId, // Only materials from the same school
        id: {
          notIn: completedMaterialIds, // Exclude completed materials
        },
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

    console.log(`[Recommendations] Found ${allMaterials.length} materials (after excluding ${completedMaterialIds.length} completed)`);

    // Step 2b: Check whether the library covers the recommended topics at all.
    // Persisted on the student so the page can warn the teacher to upload
    // materials on the missing topics, even after a reload.
    const topicCoverage = evaluateTopicCoverage({
      recommendedTopics: studentNeeds.topic,
      materials: allMaterials,
      studentLanguage: student.language,
    });
    console.log(`[Recommendations] Topic coverage:`, {
      recommended: topicCoverage.recommendedTopics,
      uncovered: topicCoverage.uncoveredTopics,
      candidates: topicCoverage.candidateCount,
    });
    try {
      await prisma.student.update({
        where: { id: studentId },
        data: { recommendationCoverage: JSON.parse(JSON.stringify(topicCoverage)) },
      });
    } catch (coverageError) {
      console.error("Failed to store topic coverage:", coverageError);
    }

    if (allMaterials.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No learning materials available for recommendations",
          metadata: { topicCoverage },
        },
        { status: 400 }
      );
    }

    // Extract key concepts from student reports for semantic matching
    const studentReportsConcepts =
      extractKeyConceptsFromReports(reportContents);

    console.log(`[Recommendations] Scoring ${allMaterials.length} materials...`);

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

    // CRITICAL FILTER: Remove materials that are too far above student's level
    const levelFilteredMaterials = scoredMaterials.filter((scored) => {
      if (scored.score < 0) return false; // Already filtered (language mismatch)
      const isTooAdvanced = isMaterialTooAdvanced(
        scored.material.level,
        studentNeeds.level
      );
      if (isTooAdvanced) {
        console.log(
          `[Level Filter] Excluding "${scored.material.title}" - level ${scored.material.level} is too advanced for student levels: ${studentNeeds.level.join(", ")}`
        );
      }
      return !isTooAdvanced;
    });

    console.log(
      `[Recommendations] Level filtering: ${scoredMaterials.length - levelFilteredMaterials.length} materials excluded (too advanced)`
    );

    // Sort by score and take top materials (limit to reasonable number for AI analysis)
    const MAX_MATERIALS_FOR_AI = 20;
    const topScoredMaterials = levelFilteredMaterials
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_MATERIALS_FOR_AI);

    console.log(`[Recommendations] Top scored materials:`, {
      count: topScoredMaterials.length,
      topScores: topScoredMaterials.slice(0, 5).map(m => ({ title: m.material.title, score: m.score })),
    });

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
          metadata: { topicCoverage },
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
          metadata: { topicCoverage },
        },
        { status: 400 }
      );
    }

    // Write scored materials to file for debugging (only in development or if writable)
    try {
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
    } catch (fsError) {
      // File system operations may fail in production (read-only file systems)
      console.warn("Could not write debug file (this is normal in production):", fsError instanceof Error ? fsError.message : fsError);
    }

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

    console.log(`[Recommendations] Calling OpenAI to generate final recommendations from ${materialsForAI.length} materials...`);
    const aiRecommendations = await generateRecommendationsFromFiltered(
      studentContext,
      studentNeeds,
      materialsForAI,
      crossLanguageGuidance
    );
    console.log(`[Recommendations] OpenAI returned ${aiRecommendations.length} recommendations`);

    // Limit to top N recommendations (AI returns them ordered by confidence)
    const MAX_RECOMMENDATIONS = 20; // Change this number to control how many recommendations are shown
    const limitedRecommendations = aiRecommendations.slice(
      0,
      MAX_RECOMMENDATIONS
    );

    console.log(`[Recommendations] Saving ${limitedRecommendations.length} recommendations to database...`);

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

    console.log(`[Recommendations] Creating progress records for ${limitedRecommendations.length} materials...`);

    // Create progress records for newly recommended materials (if they don't exist)
    await Promise.all(
      limitedRecommendations.map((rec) =>
        prisma.studentMaterialProgress.upsert({
          where: {
            studentId_learningMaterialId: {
              studentId,
              learningMaterialId: rec.materialId,
            },
          },
          update: {}, // Don't change existing progress
          create: {
            studentId,
            learningMaterialId: rec.materialId,
            isCompleted: false,
          },
        })
      )
    );

    console.log(`[Recommendations] Successfully completed! Generated ${recommendations.length} recommendations.`);

    const response: ApiResponse = {
      success: true,
      data: recommendations,
      message: `Generated ${recommendations.length} recommendations from ${filteredMaterials.length} filtered materials (${allMaterials.length} total available)`,
      metadata: {
        crossLanguageGuidance,
        topicCoverage,
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
    
    // Enhanced error logging for production debugging
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error?.constructor?.name,
      timestamp: new Date().toISOString(),
    };
    
    console.error("Detailed error information:", JSON.stringify(errorDetails, null, 2));
    
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to generate recommendations",
        details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
      },
      { status: 500 }
    );
  }
}
