import { NextRequest, NextResponse } from "next/server";
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

export async function GET() {
  try {
    const schools = await prisma.school.findMany({
      include: {
        teachers: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      data: schools,
    });
  } catch (error) {
    console.error("Error fetching schools:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
