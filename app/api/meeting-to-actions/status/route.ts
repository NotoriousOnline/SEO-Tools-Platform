import { NextResponse } from "next/server";
import { getLatestMeeting } from "@/lib/meetingStore";

export async function GET() {
  try {
    return NextResponse.json({ meeting: getLatestMeeting() });
  } catch (err) {
    console.error("[Fathom status] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
