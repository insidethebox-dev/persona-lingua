import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, address, phone, adminName, adminEmail, adminPassword } = body;

    // Validate required fields
    if (!name || !adminName || !adminEmail || !adminPassword) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if school email already exists
    const existingSchool = await prisma.school.findFirst({
      where: {
        OR: [{ name }, { email: adminEmail }],
      },
    });

    if (existingSchool) {
      if (existingSchool.name === name) {
        return NextResponse.json(
          { success: false, error: "School with this name already exists" },
          { status: 400 }
        );
      }
      if (existingSchool.email === adminEmail) {
        return NextResponse.json(
          { success: false, error: "Email already exists" },
          { status: 400 }
        );
      }
    }

    // Check if email exists as teacher
    const existingTeacher = await prisma.teacher.findUnique({
      where: { email: adminEmail },
    });

    if (existingTeacher) {
      return NextResponse.json(
        { success: false, error: "Email already exists" },
        { status: 400 }
      );
    }

    // Hash the admin password for the school
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    // Create school with admin credentials
    const school = await prisma.school.create({
      data: {
        name: name, // School name
        address,
        phone,
        email: adminEmail, // Use admin email for school login
        password: hashedPassword, // School admin password
      },
    });

    return NextResponse.json({
      success: true,
      data: school,
      message: "School admin account created successfully",
    });
  } catch (error) {
    console.error("Error creating school:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Returns the caller's own school (with its teachers). Previously this
// endpoint was unauthenticated and listed every school and teacher email
// on the platform.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!session.user.schoolId) {
      return NextResponse.json(
        { success: false, error: "No school associated with this account" },
        { status: 404 }
      );
    }

    const school = await prisma.school.findUnique({
      where: { id: session.user.schoolId },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        email: true,
        profilePicture: true,
        createdAt: true,
        teachers: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!school) {
      return NextResponse.json(
        { success: false, error: "School not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: school,
    });
  } catch (error) {
    console.error("Error fetching school:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
