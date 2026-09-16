import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiResponse } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");

    if (!studentId) {
      return NextResponse.json(
        { success: false, error: "Student ID is required" },
        { status: 400 }
      );
    }

    // Verify the caller may see this student: teachers see only their own
    // students, school admins see students of teachers in their school.
    // (Same access rule as GET /api/students.)
    const student = await prisma.student.findFirst({
      where: session.user.isSchoolAdmin
        ? { id: studentId, teacher: { schoolId: session.user.id } }
        : { id: studentId, teacherId: session.user.id },
      select: { id: true },
    });

    if (!student) {
      return NextResponse.json(
        { success: false, error: "Student not found or access denied" },
        { status: 404 }
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
