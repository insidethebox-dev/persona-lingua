import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiResponse } from "@/types";

export async function GET(request: NextRequest) {
  try {
    // Extract studentId from the URL
    const url = new URL(request.url);
    const paths = url.pathname.split("/");
    const studentId = paths[paths.indexOf("students") + 1];

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        teacher: {
          select: {
            id: true,
            name: true,
            email: true,
            subject: true,
            bio: true,
            profilePicture: true,
          },
        },
        reports: {
          orderBy: { createdAt: "desc" },
        },
        recommendations: {
          include: {
            learningMaterial: true,
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

    // Check if user has access (either a teacher or public access for viewing)
    const session = await getServerSession(authOptions);
    if (session?.user?.email) {
      const teacher = await prisma.teacher.findUnique({
        where: { email: session.user.email },
      });

      if (teacher && student.teacherId !== teacher.id) {
        return NextResponse.json(
          { success: false, error: "Access denied" },
          { status: 403 }
        );
      }
    }

    const response: ApiResponse = {
      success: true,
      data: student,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching student:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
