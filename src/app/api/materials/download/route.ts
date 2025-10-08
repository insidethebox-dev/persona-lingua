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

    // Try different approaches to fetch the file from Cloudinary
    let response;
    
    // First try: Standard fetch
    try {
      response = await fetch(fileUrl, {
        headers: {
          'User-Agent': 'PersonaLingua/1.0',
        },
      });
    } catch (error) {
      console.error('First fetch attempt failed:', error);
      throw new Error(`Failed to fetch file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // If we get a 401, try to modify the URL for public access
    if (response.status === 401) {
      console.log('Got 401, trying to modify URL for public access...');
      
      // Try to convert to a public URL format
      const publicUrl = fileUrl.replace('/upload/', '/upload/fl_attachment/');
      
      try {
        response = await fetch(publicUrl, {
          headers: {
            'User-Agent': 'PersonaLingua/1.0',
          },
        });
      } catch (error) {
        console.error('Second fetch attempt failed:', error instanceof Error ? error.message : error);
      }
    }
    
    if (!response.ok) {
      console.error(`Failed to fetch file from Cloudinary: ${response.status} ${response.statusText}`);
      console.error(`URL: ${fileUrl}`);
      
      // If still failing, redirect to the original URL and let browser handle it
      if (response.status === 401) {
        return NextResponse.redirect(fileUrl);
      }
      
      throw new Error(`Failed to fetch file: ${response.status}`);
    }

    const fileData = await response.arrayBuffer();
    const contentType =
      response.headers.get("content-type") || "application/octet-stream";

    // Clean up filename for download
    const cleanFilename = filename.replace(/[^\w\s.-]/gi, '').trim();

    // Return the file with proper headers for download
    return new NextResponse(fileData, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${cleanFilename}"`,
        "Content-Length": fileData.byteLength.toString(),
        "Cache-Control": "public, max-age=31536000",
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
