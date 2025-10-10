import { NextResponse } from "next/server";

// This route is reserved for future school-specific teacher functionality
export async function GET() {
  return NextResponse.json(
    { success: false, error: "School teacher functionality not implemented yet" },
    { status: 501 }
  );
}