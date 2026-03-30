import { NextResponse } from "next/server";
import { getLatestMeeting, getAllMeetings } from "@/lib/meetingStore";

/** In-memory store must never be cached at build time or as static JSON */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    return NextResponse.json(
      {
        meeting: getLatestMeeting(),
        meetings: getAllMeetings(),
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (err) {
    console.error("[Fathom status] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
