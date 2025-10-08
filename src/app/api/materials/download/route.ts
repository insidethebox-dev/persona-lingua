import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import cloudinary from "@/lib/cloudinary";

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg"]);

const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "avi", "mkv", "webm"]);

const sanitizeFilename = (name: string, fallback: string) => {
  const cleaned = name
    .replace(/[^\w\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || fallback;
};

const getExtension = (name?: string | null) => {
  if (!name) return null;
  const match = /\.([^.]+)$/.exec(name);
  return match ? match[1].toLowerCase() : null;
};

const determineResourceType = (
  mimeType?: string | null,
  ext?: string | null
) => {
  if (mimeType?.startsWith("image/")) return "image";
  if (mimeType?.startsWith("video/")) return "video";
  if (mimeType?.startsWith("audio/")) return "video"; // Cloudinary treats audio under video type
  if (ext && IMAGE_EXTENSIONS.has(ext)) return "image";
  if (ext && VIDEO_EXTENSIONS.has(ext)) return "video";
  return "raw";
};

const stripExtensionFromPublicId = (publicId: string) => {
  const lastSlashIdx = publicId.lastIndexOf("/");
  const namePart =
    lastSlashIdx >= 0 ? publicId.slice(lastSlashIdx + 1) : publicId;
  const dotIndex = namePart.lastIndexOf(".");

  if (dotIndex === -1) {
    return publicId;
  }

  const extension = namePart.slice(dotIndex + 1);
  const looksLikeExtension = /^[a-zA-Z0-9]{1,6}$/.test(extension);

  if (!looksLikeExtension) {
    return publicId;
  }

  const basePath = lastSlashIdx >= 0 ? publicId.slice(0, lastSlashIdx + 1) : "";
  return basePath + namePart.slice(0, dotIndex);
};

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const materialId = searchParams.get("id");

    if (!materialId) {
      return NextResponse.json(
        { success: false, error: "Missing material id" },
        { status: 400 }
      );
    }

    const material = await prisma.learningMaterial.findUnique({
      where: { id: materialId },
      include: {
        teacher: {
          select: { id: true, schoolId: true },
        },
      },
    });

    if (!material || !material.publicId) {
      return NextResponse.json(
        { success: false, error: "Material not found" },
        { status: 404 }
      );
    }

    const sameSchool =
      material.schoolId &&
      session.user.schoolId &&
      material.schoolId === session.user.schoolId;
    const sameTeacher = material.uploadedBy === session.user.id;
    const teacherSchoolMatch =
      material.teacher?.schoolId &&
      session.user.schoolId &&
      material.teacher.schoolId === session.user.schoolId;

    if (!sameTeacher && !sameSchool && !teacherSchoolMatch) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    const derivedExtension =
      getExtension(material.filename) ||
      getExtension(material.originalName) ||
      getExtension(material.publicId) ||
      (material.mimeType
        ? material.mimeType.split("/").pop()?.toLowerCase()
        : null);
    const extension = derivedExtension ?? undefined;

    const safeDownloadName = (() => {
      const base = material.filename || material.title || "material";
      const sanitized = sanitizeFilename(base, "material");
      
      // Check if the sanitized filename already has an extension
      const hasExtension = /\.[a-zA-Z0-9]{1,6}$/.test(sanitized);
      
      if (hasExtension) {
        return sanitized; // Already has extension
      } else if (extension) {
        return `${sanitized}.${extension}`; // Add extension
      } else {
        return sanitized; // No extension available
      }
    })();

    const resourceType = determineResourceType(material.mimeType, extension);
    const publicId = stripExtensionFromPublicId(material.publicId);

    // Generate the download URL with proper filename
    // Get the file URL for direct download
    const fileUrl = cloudinary.utils.private_download_url(
      publicId,
      extension || "",
      {
        resource_type: resourceType as "image" | "video" | "raw",
        attachment: false, // We'll handle the attachment header ourselves
        type: "upload",
      }
    );

    // Fetch the file and stream it with proper filename
    const fileResponse = await fetch(fileUrl);
    
    if (!fileResponse.ok) {
      throw new Error(`Failed to fetch file: ${fileResponse.status}`);
    }

    const fileData = await fileResponse.arrayBuffer();
    const contentType = fileResponse.headers.get("content-type") || "application/octet-stream";

    // Return the file with proper headers including the correct filename
    return new NextResponse(fileData, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${safeDownloadName}"`,
        "Content-Length": fileData.byteLength.toString(),
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (error) {
    console.error("Download proxy error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to prepare download" },
      { status: 500 }
    );
  }
}
