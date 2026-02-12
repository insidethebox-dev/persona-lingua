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
        { status: 404 },
      );
    }

    // Verify access
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    if (session.user.isSchoolAdmin) {
      // School admins can view students whose teacher belongs to their school
      const teacherInSchool = await prisma.teacher.findFirst({
        where: {
          id: student.teacherId,
          schoolId: session.user.id,
        },
      });
      if (!teacherInSchool) {
        return NextResponse.json(
          { success: false, error: "Access denied" },
          { status: 403 },
        );
      }
    } else {
      // Teachers can only view their own students
      if (student.teacherId !== session.user.id) {
        return NextResponse.json(
          { success: false, error: "Access denied" },
          { status: 403 },
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
      { status: 500 },
    );
  }
}

/**
 * Update student fields (currently supports notes)
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    // Extract studentId from the URL
    const url = new URL(request.url);
    const paths = url.pathname.split("/");
    const studentId = paths[paths.indexOf("students") + 1];

    if (!studentId) {
      return NextResponse.json(
        { success: false, error: "Student ID is required" },
        { status: 400 },
      );
    }

    const teacher = await prisma.teacher.findUnique({
      where: { email: session.user.email },
    });

    if (!teacher) {
      return NextResponse.json(
        { success: false, error: "Teacher not found" },
        { status: 404 },
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
        { status: 404 },
      );
    }

    const body = await request.json();
    const { notes } = body;

    // notes can be null or string
    if (notes !== null && notes !== undefined && typeof notes !== "string") {
      return NextResponse.json(
        { success: false, error: "Notes must be a string or null" },
        { status: 400 },
      );
    }

    const updatedStudent = await prisma.student.update({
      where: { id: studentId },
      data: {
        notes: notes ?? null,
      },
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

    const response: ApiResponse = {
      success: true,
      data: updatedStudent,
      message: "Student notes updated successfully",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error updating student:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
