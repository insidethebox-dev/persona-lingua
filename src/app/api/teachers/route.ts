import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiResponse } from "@/types";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only school admins can view all teachers
    if (!session.user.isSchoolAdmin) {
      return NextResponse.json(
        { success: false, error: "Access denied. School admin required." },
        { status: 403 }
      );
    }

    const teachers = await prisma.teacher.findMany({
      where: {
        schoolId: session.user.schoolId,
      },
      include: {
        school: true,
        _count: {
          select: {
            students: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const response: ApiResponse = {
      success: true,
      data: teachers,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching teachers:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch teachers" },
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

    // Only school admins can create teachers
    if (!session.user.isSchoolAdmin) {
      return NextResponse.json(
        { success: false, error: "Access denied. School admin required." },
        { status: 403 }
      );
    }

    const { name, email, password, subject, bio } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    // Check if teacher with email already exists
    const existingTeacher = await prisma.teacher.findUnique({
      where: { email },
    });

    if (existingTeacher) {
      return NextResponse.json(
        { success: false, error: "Teacher with this email already exists" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    const teacher = await prisma.teacher.create({
      data: {
        name,
        email,
        password: hashedPassword,
        schoolId: session.user.schoolId,
        subject: subject || null,
        bio: bio || null,
      },
      include: {
        school: true,
        _count: {
          select: {
            students: true,
          },
        },
      },
    });

    const response: ApiResponse = {
      success: true,
      data: teacher,
      message: "Teacher created successfully",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error creating teacher:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create teacher" },
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

    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get("id");

    if (!teacherId) {
      return NextResponse.json(
        { success: false, error: "Teacher ID is required" },
        { status: 400 }
      );
    }

    // Get the teacher to check ownership
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
    });

    if (!teacher) {
      return NextResponse.json(
        { success: false, error: "Teacher not found" },
        { status: 404 }
      );
    }

    // Only school admins or the teacher themselves can update
    if (!session.user.isSchoolAdmin && session.user.id !== teacherId) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    // School admins can only update teachers from their school
    if (
      session.user.isSchoolAdmin &&
      teacher.schoolId !== session.user.schoolId
    ) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    const updateData = await request.json();

    // Remove sensitive fields that shouldn't be updated this way
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, email, schoolId, ...allowedFields } = updateData;

    const updatedTeacher = await prisma.teacher.update({
      where: { id: teacherId },
      data: allowedFields,
      include: {
        school: true,
        _count: {
          select: {
            students: true,
          },
        },
      },
    });

    const response: ApiResponse = {
      success: true,
      data: updatedTeacher,
      message: "Teacher updated successfully",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error updating teacher:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update teacher" },
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

    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get("id");

    if (!teacherId) {
      return NextResponse.json(
        { success: false, error: "Teacher ID is required" },
        { status: 400 }
      );
    }

    // Get the teacher to check ownership
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      include: {
        _count: {
          select: {
            students: true,
          },
        },
      },
    });

    if (!teacher) {
      return NextResponse.json(
        { success: false, error: "Teacher not found" },
        { status: 404 }
      );
    }

    // Only school admins can delete teachers (and they can't delete themselves)
    if (!session.user.isSchoolAdmin || session.user.id === teacherId) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    // School admins can only delete teachers from their school
    if (teacher.schoolId !== session.user.schoolId) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    // Check if teacher has students
    if (teacher._count.students > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete teacher. They have ${teacher._count.students} students assigned. Please reassign students first.`,
        },
        { status: 400 }
      );
    }

    await prisma.teacher.delete({
      where: { id: teacherId },
    });

    const response: ApiResponse = {
      success: true,
      message: "Teacher deleted successfully",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error deleting teacher:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete teacher" },
      { status: 500 }
    );
  }
}
