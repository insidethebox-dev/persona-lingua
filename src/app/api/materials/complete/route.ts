import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
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

    const { studentId, materialId, isCompleted } = await request.json();

    if (!studentId || !materialId || typeof isCompleted !== "boolean") {
      return NextResponse.json(
        {
          success: false,
          error: "Student ID, Material ID, and completion status are required",
        },
        { status: 400 }
      );
    }

    // Verify the student belongs to this teacher
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        teacherId: teacher.id,
      },
    });

    if (!student) {
      return NextResponse.json(
        { success: false, error: "Student not found or access denied" },
        { status: 404 }
      );
    }

    // Update or create progress record
    const progress = await prisma.studentMaterialProgress.upsert({
      where: {
        studentId_learningMaterialId: {
          studentId,
          learningMaterialId: materialId,
        },
      },
      update: {
        isCompleted,
        updatedAt: new Date(),
      },
      create: {
        studentId,
        learningMaterialId: materialId,
        isCompleted,
      },
    });

    return NextResponse.json({
      success: true,
      data: progress,
      message: `Material marked as ${isCompleted ? "completed" : "incomplete"}`,
    });
  } catch (error) {
    console.error("Error updating material completion status:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update material completion status" },
      { status: 500 }
    );
  }
}
