import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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
    const fileUrl = searchParams.get("url");
    const filename = searchParams.get("filename") || "download";

    if (!fileUrl) {
      return NextResponse.json(
        { success: false, error: "Missing file URL" },
        { status: 400 }
      );
    }

    // Fetch the file from Cloudinary
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status}`);
    }

    const fileData = await response.arrayBuffer();
    const contentType =
      response.headers.get("content-type") || "application/octet-stream";

    // Return the file with proper headers for download
    return new NextResponse(fileData, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": fileData.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("Download proxy error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to download file" },
      { status: 500 }
    );
  }
}
