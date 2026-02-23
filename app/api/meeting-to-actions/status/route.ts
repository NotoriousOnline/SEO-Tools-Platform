import { NextResponse } from "next/server";
import { getLatestMeeting, getAllMeetings } from "@/lib/meetingStore";

export async function GET() {
  try {
    return NextResponse.json({
      meeting: getLatestMeeting(),
      meetings: getAllMeetings(),
    });
  } catch (err) {
    console.error("[Fathom status] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
