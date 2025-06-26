import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    const { name, age, grade, notes } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { success: false, error: "Student name is required" },
        { status: 400 }
      );
    }

    // Create student
    const student = await prisma.student.create({
      data: {
        name,
        age: age ? parseInt(age) : null,
        grade,
        notes,
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
