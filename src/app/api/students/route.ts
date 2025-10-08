import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface CreateStudentData {
  name: string;
  age: number | null;
  grade: string | null;
  notes: string | null;
  learningBarriers: string[];
  teacherId: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, age, grade, notes, learningBarriers } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { success: false, error: "Student name is required" },
        { status: 400 }
      );
    }

    // Create student
    const studentData: CreateStudentData = {
      name,
      age: age ? parseInt(age) : null,
      grade,
      notes,
      learningBarriers: learningBarriers || [],
      teacherId: session.user.id,
    };

    const student = await prisma.student.create({
      data: studentData,
      include: {
        teacher: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: student,
      message: "Student created successfully",
    });
  } catch (error) {
    console.error("Error creating student:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const students = await prisma.student.findMany({
      where: {
        teacherId: session.user.id,
      },
      include: {
        teacher: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        reports: {
          orderBy: {
            createdAt: "desc",
          },
          take: 3, // Get latest 3 reports
        },
        recommendations: {
          include: {
            learningMaterial: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 5, // Get latest 5 recommendations
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      data: students,
    });
  } catch (error) {
    console.error("Error fetching students:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("id");

    if (!studentId) {
      return NextResponse.json(
        { success: false, error: "Student ID is required" },
        { status: 400 }
      );
    }

    // First, verify the student exists and belongs to the current teacher
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        teacher: {
          select: {
            id: true,
            schoolId: true,
          },
        },
      },
    });

    if (!student) {
      return NextResponse.json(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }

    // Check if the student belongs to the current teacher
    if (student.teacherId !== session.user.id) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized - You can only delete your own students",
        },
        { status: 403 }
      );
    }

    // Get current teacher's school to double-check authorization
    const currentTeacher = await prisma.teacher.findUnique({
      where: { id: session.user.id },
      select: { schoolId: true },
    });

    if (
      !currentTeacher ||
      currentTeacher.schoolId !== student.teacher.schoolId
    ) {
      return NextResponse.json(
        { success: false, error: "Unauthorized - Cross-school access denied" },
        { status: 403 }
      );
    }

    // Delete the student (this will cascade delete reports and recommendations due to schema)
    await prisma.student.delete({
      where: { id: studentId },
    });

    return NextResponse.json({
      success: true,
      message: "Student deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting student:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
