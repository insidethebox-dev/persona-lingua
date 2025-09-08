import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();

    // Validate inputs
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { message: "Current password and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { message: "New password must be at least 6 characters long" },
        { status: 400 }
      );
    }

    const userId = session.user.id;
    const isSchoolAdmin = session.user.isSchoolAdmin;

    // Get current user data
    let currentUser;
    if (isSchoolAdmin) {
      currentUser = await prisma.school.findUnique({
        where: { id: userId },
        select: { id: true, password: true },
      });
    } else {
      currentUser = await prisma.teacher.findUnique({
        where: { id: userId },
        select: { id: true, password: true },
      });
    }

    if (!currentUser || !currentUser.password) {
      return NextResponse.json(
        { message: "User not found or password not set" },
        { status: 404 }
      );
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      currentUser.password
    );

    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { message: "Current password is incorrect" },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    if (isSchoolAdmin) {
      await prisma.school.update({
        where: { id: userId },
        data: { password: hashedNewPassword },
      });
    } else {
      await prisma.teacher.update({
        where: { id: userId },
        data: { password: hashedNewPassword },
      });
    }

    return NextResponse.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error updating password:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
