import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import cloudinary from "@/lib/cloudinary";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const aiSummary = formData.get("aiSummary") as string;
    const topic = formData.get("topic") as string;
    const level = formData.get("level") as string;
    const type = formData.get("type") as string;
    const skill = formData.get("skill") as string;
    const tags = formData.get("tags") as string;

    // Validate required fields
    if (!file || !title || !topic || !level || !type || !skill) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "File size exceeds 10MB limit" },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Cloudinary
    const uploadResult = await new Promise<{
      secure_url: string;
      public_id: string;
    }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            resource_type: "auto",
            folder: process.env.CLOUDINARY_FOLDER || "personalingua",
            public_id: `${Date.now()}-${file.name}`,
          },
          (error, result) => {
            if (error) reject(error);
            else if (result) resolve(result);
            else reject(new Error("Upload failed"));
          }
        )
        .end(buffer);
    });

    // Parse tags
    const tagArray = tags
      ? tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      : [];

    // Save to database
    const material = await prisma.learningMaterial.create({
      data: {
        title,
        description: description || null,
        aiSummary: aiSummary || null,
        filename: file.name,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        fileUrl: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        topic,
        level,
        type,
        skill,
        tags: tagArray,
        uploadedBy: session.user.id,
        schoolId: session.user.schoolId,
      },
    });

    return NextResponse.json({
      success: true,
      data: material,
      message: "Material uploaded successfully",
    });
  } catch (error) {
    console.error("Error uploading material:", error);
    return NextResponse.json(
      { success: false, error: "Failed to upload material" },
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

    const materials = await prisma.learningMaterial.findMany({
      //   where: {
      //     schoolId: session.user.schoolId,
      //   },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      data: materials,
    });
  } catch (error) {
    console.error("Error fetching materials:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch materials" },
      { status: 500 }
    );
  }
}
