import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateLearningFootpath } from "@/lib/openai";
import { ApiResponse } from "@/types";

// The footpath prompt runs on a reasoning model; allow a long serverless run.
export const maxDuration = 300;

/**
 * POST /api/students/[studentId]/footpath
 *
 * Reads the student's persona (profile, teacher notes, progress reports) and
 * generates (or regenerates) a personalized lesson footpath for the teacher.
 * The result is stored on the student record so it is shown on every visit.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    // Extract studentId from the URL (/api/students/<id>/footpath)
    const url = new URL(request.url);
    const paths = url.pathname.split("/");
    const studentId = paths[paths.indexOf("students") + 1];

    if (!studentId || studentId === "footpath") {
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

    // Only the student's own teacher can generate a footpath
    const student = await prisma.student.findFirst({
      where: { id: studentId, teacherId: teacher.id },
      include: {
        reports: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { title: true, content: true, createdAt: true },
        },
      },
    });

    if (!student) {
      return NextResponse.json(
        { success: false, error: "Student not found or access denied" },
        { status: 404 },
      );
    }

    const hasNotes = Boolean(student.notes && student.notes.trim());
    if (!hasNotes && student.reports.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Add teacher notes or at least one progress report before generating a lesson footpath.",
        },
        { status: 400 },
      );
    }

    console.log(
      `[Footpath] Generating for student ${student.id} (${student.reports.length} reports, notes: ${hasNotes})`,
    );

    const footpath = await generateLearningFootpath({
      name: student.name,
      language: student.language,
      grade: student.grade,
      age: student.age,
      learningBarriers: student.learningBarriers,
      notes: student.notes,
      reports: student.reports,
    });

    const generatedAt = new Date();
    const updated = await prisma.student.update({
      where: { id: student.id },
      data: {
        learningFootpath: JSON.parse(JSON.stringify(footpath)),
        footpathGeneratedAt: generatedAt,
      },
      select: { learningFootpath: true, footpathGeneratedAt: true },
    });

    const response: ApiResponse = {
      success: true,
      data: updated,
      message: `Generated a ${footpath.stages.length}-stage lesson footpath for ${student.name}`,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error generating lesson footpath:", error);
    const errorMessage =
      error instanceof Error && error.message
        ? error.message
        : "Failed to generate lesson footpath";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
