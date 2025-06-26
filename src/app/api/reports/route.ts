import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiResponse } from "@/types";

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");

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
    });

    if (!student) {
      return NextResponse.json(
        { success: false, error: "Student not found or access denied" },
        { status: 404 }
      );
    }

    const reports = await prisma.studentReport.findMany({
      where: { studentId },
      orderBy: { createdAt: "desc" },
    });

    const response: ApiResponse = {
      success: true,
      data: reports,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching reports:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

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

    const { title, content, studentId } = await request.json();

    if (!title || !content || !studentId) {
      return NextResponse.json(
        {
          success: false,
          error: "Title, content, and student ID are required",
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

    const report = await prisma.studentReport.create({
      data: {
        title,
        content,
        studentId,
      },
    });

    const response: ApiResponse = {
      success: true,
      data: report,
      message: "Report created successfully",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error creating report:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
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

    const { id, title, content, studentId } = await request.json();

    if (!id || !title || !content || !studentId) {
      return NextResponse.json(
        {
          success: false,
          error: "ID, title, content, and student ID are required",
        },
        { status: 400 }
      );
    }

    // Verify the student belongs to this teacher and the report exists
    const existingReport = await prisma.studentReport.findFirst({
      where: {
        id,
        student: {
          teacherId: teacher.id,
        },
      },
    });

    if (!existingReport) {
      return NextResponse.json(
        { success: false, error: "Report not found or access denied" },
        { status: 404 }
      );
    }

    const report = await prisma.studentReport.update({
      where: { id },
      data: {
        title,
        content,
      },
    });

    const response: ApiResponse = {
      success: true,
      data: report,
      message: "Report updated successfully",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error updating report:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get("id");

    if (!reportId) {
      return NextResponse.json(
        { success: false, error: "Report ID is required" },
        { status: 400 }
      );
    }

    // Verify the report belongs to this teacher's student
    const existingReport = await prisma.studentReport.findFirst({
      where: {
        id: reportId,
        student: {
          teacherId: teacher.id,
        },
      },
    });

    if (!existingReport) {
      return NextResponse.json(
        { success: false, error: "Report not found or access denied" },
        { status: 404 }
      );
    }

    await prisma.studentReport.delete({
      where: { id: reportId },
    });

    const response: ApiResponse = {
      success: true,
      message: "Report deleted successfully",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error deleting report:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
