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

    // Validate required fields (topic is now optional)
    if (!file || !title || !level || !type || !skill) {
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

    const stripExt = (name: string) => name.replace(/\.[^/.]+$/, "");

    // Better slugify that preserves more characters
    const slugify = (s: string) =>
      s
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "") // remove diacritics
        .replace(/[^a-zA-Z0-9._-\s]+/g, "") // keep more safe chars including spaces
        .replace(/\s+/g, "_") // replace spaces with underscores
        .replace(/_{2,}/g, "_") // replace multiple underscores with single
        .replace(/^_|_$/g, "") // remove leading/trailing underscores
        .substring(0, 100); // limit length

    // Sanitize filename - keep it readable but safe
    const base = stripExt(file.name);
    const safeBase = slugify(base) || "untitled"; // fallback for empty base

    // Generate shorter unique ID to avoid long filenames
    const uniqueId =
      Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

    const publicId = `${safeBase}_${uniqueId}`;

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    const resourceType = isImage ? "image" : isVideo ? "video" : "raw";

    // Upload to Cloudinary with proper configuration
    const uploadOptions: {
      resource_type: "image" | "raw" | "video" | "auto";
      folder: string;
      public_id: string;
      unique_filename: boolean;
      access_mode: "public";
      overwrite: boolean;
      type: "upload";
      delivery_type: "upload";
      flags?: string;
    } = {
      resource_type: resourceType as "image" | "raw" | "video" | "auto",
      folder: process.env.CLOUDINARY_FOLDER || "personalingua",
      public_id: publicId,
      unique_filename: false,
      access_mode: "public" as const, // Ensure files are publicly accessible
      overwrite: false, // Don't overwrite existing files
      type: "upload" as const, // Explicitly set upload type
      delivery_type: "upload" as const, // Ensure public delivery
    };

    if (resourceType === "raw") {
      uploadOptions.flags = "attachment";
    }

    const uploadResult = await new Promise<{
      secure_url: string;
      public_id: string;
      format?: string;
    }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(uploadOptions, (error, result) => {
          if (error) {
            console.error("Cloudinary upload error:", error);
            reject(error);
          } else if (result) {
            resolve(result);
          } else {
            reject(new Error("Upload failed - no result"));
          }
        })
        .end(buffer);
    });

    // Parse tags
    const tagArray = tags
      ? tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      : [];

    // Save to database with proper relationships
    const material = await prisma.learningMaterial.create({
      data: {
        title,
        description: description || null,
        aiSummary: aiSummary || null,
        filename: file.name, // Keep original filename for display
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        fileUrl: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        topic: topic || null, // Handle empty topic as null
        level,
        type,
        skill,
        tags: tagArray,
        uploadedBy: session.user.id,
        schoolId: session.user.schoolId || null, // Handle null schoolId
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

    // Filter materials by school - only show materials from the user's school
    const whereClause = session.user.schoolId 
      ? { schoolId: session.user.schoolId }
      : { uploadedBy: session.user.id }; // Fallback for independent teachers

    const materials = await prisma.learningMaterial.findMany({
      where: whereClause,
      include: {
        teacher: {
          select: {
            name: true,
            email: true,
            subject: true,
          },
        },
        school: {
          select: {
            name: true,
          },
        },
      },
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
