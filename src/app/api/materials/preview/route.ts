import { NextResponse } from "next/server";

// This route is reserved for future material preview functionality
export async function GET() {
  return NextResponse.json(
    { success: false, error: "Preview functionality not implemented yet" },
    { status: 501 }
  );
}
