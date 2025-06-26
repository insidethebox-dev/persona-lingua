import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";
import { v2 as cloudinary } from "cloudinary";

const prisma = new PrismaClient();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { message: "No file uploaded" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { message: "File must be an image" },
        { status: 400 }
      );
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { message: "File size must be less than 5MB" },
        { status: 400 }
      );
    }

    const userId = session.user.id;
    const isSchoolAdmin = session.user.isSchoolAdmin;

    // Get current user data to delete old image if exists
    let currentUser;
    if (isSchoolAdmin) {
      currentUser = await prisma.school.findUnique({
        where: { id: userId },
        select: { publicId: true },
      });
    } else {
      currentUser = await prisma.teacher.findUnique({
        where: { id: userId },
        select: { publicId: true },
      });
    }

    // Delete old image from Cloudinary if it exists
    if (currentUser?.publicId) {
      try {
        await cloudinary.uploader.destroy(currentUser.publicId);
      } catch (error) {
        console.error("Error deleting old image from Cloudinary:", error);
      }
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
            resource_type: "image",
            folder: "persona-lingua/profiles",
            transformation: [
              { width: 400, height: 400, crop: "fill", gravity: "face" },
              { quality: "auto" },
              { format: "webp" },
            ],
          },
          (error, result) => {
            if (error) reject(error);
            else if (result)
              resolve({
                secure_url: result.secure_url,
                public_id: result.public_id,
              });
            else reject(new Error("Upload failed"));
          }
        )
        .end(buffer);
    });

    // Update database with new image URLs
    let updatedUser;
    if (isSchoolAdmin) {
      updatedUser = await prisma.school.update({
        where: { id: userId },
        data: {
          profilePicture: uploadResult.secure_url,
          publicId: uploadResult.public_id,
        },
        select: {
          profilePicture: true,
          publicId: true,
        },
      });
    } else {
      updatedUser = await prisma.teacher.update({
        where: { id: userId },
        data: {
          profilePicture: uploadResult.secure_url,
          publicId: uploadResult.public_id,
        },
        select: {
          profilePicture: true,
          publicId: true,
        },
      });
    }

    return NextResponse.json({
      profilePicture: updatedUser.profilePicture,
      publicId: updatedUser.publicId,
    });
  } catch (error) {
    console.error("Error uploading profile picture:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
