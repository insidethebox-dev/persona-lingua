import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiResponse } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");

    if (!studentId) {
      return NextResponse.json(
        { success: false, error: "Student ID is required" },
        { status: 400 }
      );
    }

    const recommendations = await prisma.recommendation.findMany({
      where: { studentId },
      include: {
        learningMaterial: true,
      },
      orderBy: { confidence: "desc" },
    });

    const response: ApiResponse = {
      success: true,
      data: recommendations,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
