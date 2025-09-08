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

// GET - Fetch user profile
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const isSchoolAdmin = session.user.isSchoolAdmin;

    if (isSchoolAdmin) {
      const profile = await prisma.school.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          address: true,
          phone: true,
          profilePicture: true,
          publicId: true,
        },
      });

      if (!profile) {
        return NextResponse.json(
          { message: "Profile not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        ...profile,
        isSchoolAdmin: true,
        schoolName: profile.name,
      });
    } else {
      const profile = await prisma.teacher.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          subject: true,
          bio: true,
          profilePicture: true,
          publicId: true,
          school: {
            select: {
              name: true,
            },
          },
        },
      });

      if (!profile) {
        return NextResponse.json(
          { message: "Profile not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        ...profile,
        isSchoolAdmin: false,
        schoolName: profile.school?.name,
      });
    }
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT - Update user profile
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { name, subject, bio, address, phone, email } = await request.json();
    const userId = session.user.id;
    const isSchoolAdmin = session.user.isSchoolAdmin;

    if (!name?.trim()) {
      return NextResponse.json(
        { message: "Name is required" },
        { status: 400 }
      );
    }

    if (isSchoolAdmin) {
      // For school admins, validate email if it's being changed
      if (email && email !== session.user.email) {
        const existingSchool = await prisma.school.findUnique({
          where: { email: email.trim() },
        });

        if (existingSchool && existingSchool.id !== userId) {
          return NextResponse.json(
            { message: "Email is already in use" },
            { status: 400 }
          );
        }
      }

      const updateData: {
        name: string;
        address?: string | null;
        phone?: string | null;
        email?: string;
      } = {
        name: name.trim(),
      };

      if (address !== undefined) updateData.address = address?.trim() || null;
      if (phone !== undefined) updateData.phone = phone?.trim() || null;
      if (email !== undefined) updateData.email = email.trim();

      const updatedProfile = await prisma.school.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          address: true,
          phone: true,
          profilePicture: true,
          publicId: true,
        },
      });

      return NextResponse.json({
        ...updatedProfile,
        isSchoolAdmin: true,
        schoolName: updatedProfile.name,
      });
    } else {
      const updatedProfile = await prisma.teacher.update({
        where: { id: userId },
        data: {
          name: name.trim(),
          subject: subject?.trim() || null,
          bio: bio?.trim() || null,
        },
        select: {
          id: true,
          name: true,
          email: true,
          subject: true,
          bio: true,
          profilePicture: true,
          publicId: true,
          school: {
            select: {
              name: true,
            },
          },
        },
      });

      return NextResponse.json({
        ...updatedProfile,
        isSchoolAdmin: false,
        schoolName: updatedProfile.school?.name,
      });
    }
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete user account
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const isSchoolAdmin = session.user.isSchoolAdmin;

    if (isSchoolAdmin) {
      // For school admins, we need to handle teacher transfer
      const school = await prisma.school.findUnique({
        where: { id: userId },
        include: {
          teachers: true,
        },
      });

      if (!school) {
        return NextResponse.json(
          { message: "School not found" },
          { status: 404 }
        );
      }

      // Delete profile picture from Cloudinary if it exists
      if (school.publicId) {
        try {
          await cloudinary.uploader.destroy(school.publicId);
        } catch (error) {
          console.error("Error deleting image from Cloudinary:", error);
        }
      }

      // Use a transaction to handle teacher transfer and school deletion
      await prisma.$transaction(async (tx) => {
        // Set all teachers' schoolId to null (make them independent)
        await tx.teacher.updateMany({
          where: { schoolId: userId },
          data: { schoolId: null },
        });

        // Delete the school
        await tx.school.delete({
          where: { id: userId },
        });
      });
    } else {
      // For teachers, check if they have students
      const teacher = await prisma.teacher.findUnique({
        where: { id: userId },
        include: {
          students: true,
        },
      });

      if (!teacher) {
        return NextResponse.json(
          { message: "Teacher not found" },
          { status: 404 }
        );
      }

      if (teacher.students.length > 0) {
        return NextResponse.json(
          {
            message:
              "Cannot delete account with existing students. Please delete all students first.",
          },
          { status: 400 }
        );
      }

      // Delete profile picture from Cloudinary if it exists
      if (teacher.publicId) {
        try {
          await cloudinary.uploader.destroy(teacher.publicId);
        } catch (error) {
          console.error("Error deleting image from Cloudinary:", error);
        }
      }

      // Delete the teacher
      await prisma.teacher.delete({
        where: { id: userId },
      });
    }

    return NextResponse.json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Error deleting account:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
