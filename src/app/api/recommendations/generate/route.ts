import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  analyzeStudentNeeds,
  generateRecommendationsFromFiltered,
} from "@/lib/openai";
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

    // Score materials based on deterministic criteria with language match weighted highest
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
      };
      rationale: string[];
    }

    const scoredMaterials: ScoredMaterial[] = allMaterials.map((material) => {
      const breakdown = {
        languageMatch: 0,
        topicMatch: 0,
        levelMatch: 0,
        typeMatch: 0,
        skillMatch: 0,
        tagMatch: 0,
        accessibilityMatch: 0,
      };
      const rationale: string[] = [];

      // Language match - highest weight (40% of total score)
      if (material.language === student.language) {
        breakdown.languageMatch = 40;
        rationale.push(`Perfect language match (${student.language})`);
      } else if (material.language) {
        // Slight penalty for different language
        breakdown.languageMatch = -10;
        rationale.push(
          `Language mismatch (Material: ${material.language}, Student: ${student.language})`
        );
      }

      // Topic match - 20% weight
      if (material.topic && studentNeeds.topic.includes(material.topic)) {
        breakdown.topicMatch = 20;
        rationale.push(`Topic match: ${material.topic}`);
      }

      // Level match - 15% weight
      if (studentNeeds.level.includes(material.level)) {
        breakdown.levelMatch = 15;
        rationale.push(`Level match: ${material.level}`);
      }

      // Type match - 10% weight
      if (studentNeeds.type.includes(material.type)) {
        breakdown.typeMatch = 10;
        rationale.push(`Type match: ${material.type}`);
      }

      // Skill match - 10% weight
      if (studentNeeds.skill.includes(material.skill)) {
        breakdown.skillMatch = 10;
        rationale.push(`Skill match: ${material.skill}`);
      }

      // Tag match - 5% weight (distributed across matching tags)
      const matchingTags = studentNeeds.tags.filter((needTag) =>
        material.tags.some(
          (materialTag) =>
            materialTag.toLowerCase().includes(needTag.toLowerCase()) ||
            needTag.toLowerCase().includes(materialTag.toLowerCase())
        )
      );
      if (matchingTags.length > 0) {
        breakdown.tagMatch = Math.min(5, matchingTags.length * 2);
        rationale.push(`Tag matches: ${matchingTags.join(", ")}`);
      }

      // Learning barrier accommodation check - bonus points
      if (student.learningBarriers.length > 0) {
        const accessibilityKeywords = [
          "visual",
          "audio",
          "dyslexia",
          "adhd",
          "autism",
          "hearing",
          "mobility",
          "cognitive",
        ];
        const materialText = `${material.title} ${
          material.description || ""
        } ${material.tags.join(" ")}`.toLowerCase();

        const hasAccessibilityFeatures = accessibilityKeywords.some(
          (keyword) =>
            materialText.includes(keyword) ||
            material.tags.some((tag) => tag.toLowerCase().includes(keyword))
        );

        if (hasAccessibilityFeatures) {
          breakdown.accessibilityMatch = 10;
          rationale.push("Contains accessibility accommodations");
        }
      }

      const totalScore = Object.values(breakdown).reduce(
        (sum, score) => sum + score,
        0
      );

      return {
        material,
        score: totalScore,
        scoreBreakdown: breakdown,
        rationale,
      };
    });

    // Sort by score and take top materials (limit to reasonable number for AI analysis)
    const topScoredMaterials = scoredMaterials
      .sort((a, b) => b.score - a.score)
      .slice(0, 20); // Limit to top 20 materials for AI analysis

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

    // Step 3: Use AI to recommend the best materials from the filtered set
    // Prepare data for AI analysis with scoring context
    const materialsForAI = topScoredMaterials.map((scoredMaterial) => ({
      ...scoredMaterial.material,
      description: scoredMaterial.material.description || undefined,
      topic: scoredMaterial.material.topic || "general", // Ensure topic is never null
      preScore: scoredMaterial.score,
      scoreRationale: scoredMaterial.rationale.join("; "),
    }));

    const aiRecommendations = await generateRecommendationsFromFiltered(
      studentContext,
      studentNeeds,
      materialsForAI,
      crossLanguageGuidance
    );

    // Clear existing recommendations for this student
    await prisma.recommendation.deleteMany({
      where: { studentId },
    });

    // Save new recommendations with pre-score data
    const recommendations = await Promise.all(
      aiRecommendations.map((rec) => {
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
