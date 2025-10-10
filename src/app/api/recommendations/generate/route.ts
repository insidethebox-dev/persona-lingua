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

    // Step 1: Analyze student needs using AI
    const reportContents = student.reports.map((report) => report.content);
    const studentNeeds = await analyzeStudentNeeds(
      reportContents,
      student.name
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

    // Filter materials based on student needs analysis
    const filteredMaterials = allMaterials.filter((material) => {
      // Check if material matches any of the recommended criteria
      const topicMatch = material.topic ? studentNeeds.topic.includes(material.topic) : false;
      const levelMatch = studentNeeds.level.includes(material.level);
      const typeMatch = studentNeeds.type.includes(material.type);
      const skillMatch = studentNeeds.skill.includes(material.skill);

      // Check for tag matches
      const tagMatch = studentNeeds.tags.some((needTag) =>
        material.tags.some(
          (materialTag) =>
            materialTag.toLowerCase().includes(needTag.toLowerCase()) ||
            needTag.toLowerCase().includes(materialTag.toLowerCase())
        )
      );

      // Material should match at least 2 criteria to be considered relevant
      const matches = [topicMatch, levelMatch, typeMatch, skillMatch, tagMatch];
      const matchCount = matches.filter(Boolean).length;

      return matchCount >= 2;
    });

    if (filteredMaterials.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No materials match the student's learning needs",
        },
        { status: 400 }
      );
    }

    // Step 3: Use AI to recommend the best materials from the filtered set
    // Prepare data for AI analysis
    const materialsForAI = filteredMaterials.map((material) => ({
      ...material,
      description: material.description || undefined,
      topic: material.topic || "general", // Ensure topic is never null
    }));

    const aiRecommendations = await generateRecommendationsFromFiltered(
      student.name,
      studentNeeds,
      materialsForAI
    );

    // Clear existing recommendations for this student
    await prisma.recommendation.deleteMany({
      where: { studentId },
    });

    // Save new recommendations
    const recommendations = await Promise.all(
      aiRecommendations.map((rec) =>
        prisma.recommendation.create({
          data: {
            studentId,
            learningMaterialId: rec.materialId,
            reason: rec.reason,
            confidence: rec.confidence,
          },
        })
      )
    );

    const response: ApiResponse = {
      success: true,
      data: recommendations,
      message: `Generated ${recommendations.length} recommendations from ${filteredMaterials.length} filtered materials (${allMaterials.length} total available)`,
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
