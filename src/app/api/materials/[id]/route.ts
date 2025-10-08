import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Schema for updating material data
const updateMaterialSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  topic: z.string().nullable().optional(),
  level: z.string().min(1, "Level is required"),
  type: z.string().min(1, "Type is required"),
  skill: z.string().min(1, "Skill is required"),
  tags: z.array(z.string()).optional(),
});

// GET /api/materials/[id] - Get a single material
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const material = await prisma.learningMaterial.findUnique({
      where: { id: params.id },
      include: {
        teacher: {
          select: {
            name: true,
            email: true,
            subject: true,
            schoolId: true,
          },
        },
        school: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!material) {
      return NextResponse.json(
        { success: false, error: "Material not found" },
        { status: 404 }
      );
    }

    // Check if user has access to this material (same school)
    if (material.teacher.schoolId !== session.user.schoolId) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: material,
    });
  } catch (error) {
    console.error("Error fetching material:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/materials/[id] - Update a material
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only school admins can edit materials
    if (!session.user.isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: "Only school administrators can edit materials",
        },
        { status: 403 }
      );
    }

    // Get the material to check ownership
    const existingMaterial = await prisma.learningMaterial.findUnique({
      where: { id: params.id },
      include: {
        teacher: {
          select: {
            schoolId: true,
          },
        },
      },
    });

    if (!existingMaterial) {
      return NextResponse.json(
        { success: false, error: "Material not found" },
        { status: 404 }
      );
    }

    // Check if material belongs to the same school
    if (existingMaterial.teacher.schoolId !== session.user.schoolId) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updateMaterialSchema.parse(body);

    // Update the material
    const updatedMaterial = await prisma.learningMaterial.update({
      where: { id: params.id },
      data: {
        title: validatedData.title,
        description: validatedData.description || null,
        topic: validatedData.topic === "" ? null : validatedData.topic,
        level: validatedData.level,
        type: validatedData.type,
        skill: validatedData.skill,
        tags: validatedData.tags || [],
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedMaterial,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error("Error updating material:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/materials/[id] - Delete a material (optional for future use)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only school admins can delete materials
    if (!session.user.isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: "Only school administrators can delete materials",
        },
        { status: 403 }
      );
    }

    // Get the material to check ownership
    const existingMaterial = await prisma.learningMaterial.findUnique({
      where: { id: params.id },
      include: {
        teacher: {
          select: {
            schoolId: true,
          },
        },
      },
    });

    if (!existingMaterial) {
      return NextResponse.json(
        { success: false, error: "Material not found" },
        { status: 404 }
      );
    }

    // Check if material belongs to the same school
    if (existingMaterial.teacher.schoolId !== session.user.schoolId) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    // Delete the material
    await prisma.learningMaterial.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
      message: "Material deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting material:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
