import { NextResponse } from "next/server";
import { setLatestMeeting, getLatestMeeting } from "@/lib/meetingStore";

type ManualBody = {
  meeting_title?: string;
  date?: string;
  participants?: string;
  summary?: string;
  transcript?: string;
};

function parseParticipants(participantsStr: string): string[] {
  if (typeof participantsStr !== "string") return [];
  return participantsStr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function POST(request: Request) {
  try {
    let body: ManualBody;
    try {
      body = (await request.json()) as ManualBody;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const meeting_title = String(body.meeting_title ?? "");
    const date = String(body.date ?? "");
    const participants = parseParticipants(body.participants ?? "");
    const summary = String(body.summary ?? "");
    const transcript = String(body.transcript ?? "");

    const meeting = {
      meeting_title,
      date,
      participants,
      summary,
      transcript,
      action_items: [] as string[],
      source: "manual" as const,
    };

    setLatestMeeting(meeting);

    return NextResponse.json({
      success: true,
      meeting: getLatestMeeting(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Manual meeting] Error:", msg);
    return NextResponse.json(
      { error: msg || "Internal server error" },
      { status: 500 }
    );
  }
}
