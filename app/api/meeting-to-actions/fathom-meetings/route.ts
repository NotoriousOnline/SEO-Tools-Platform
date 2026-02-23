import { NextResponse } from "next/server";
import type { MeetingPayload } from "@/lib/meetingStore";

type FathomTranscriptItem = { speaker?: { display_name?: string }; text?: string; timestamp?: string };
type FathomMeeting = {
  title?: string;
  meeting_title?: string;
  recording_id?: number;
  url?: string;
  share_url?: string;
  created_at?: string;
  transcript?: FathomTranscriptItem[];
  default_summary?: { markdown_formatted?: string };
  calendar_invitees?: { name?: string; email?: string }[];
};

function fathomToPayload(m: FathomMeeting, index: number): MeetingPayload {
  const transcriptStr = Array.isArray(m.transcript)
    ? m.transcript.map((t) => `${t.speaker?.display_name ?? "Speaker"}: ${t.text ?? ""}`).join("\n")
    : "";
  const summary = m.default_summary?.markdown_formatted ?? "";
  const participants = (m.calendar_invitees ?? []).map((c) => c.name || c.email || "").filter(Boolean);
  const meetingUrls: string[] = [];
  if (m.url && m.url.startsWith("http")) meetingUrls.push(m.url);
  if (m.share_url && m.share_url.startsWith("http") && !meetingUrls.includes(m.share_url)) meetingUrls.push(m.share_url);

  return {
    id: `fathom-${m.recording_id ?? index}`,
    meeting_title: m.meeting_title ?? m.title ?? "Untitled Meeting",
    date: m.created_at ?? new Date().toISOString(),
    participants,
    summary,
    action_items: [],
    transcript: transcriptStr,
    meeting_urls: meetingUrls.length > 0 ? meetingUrls : undefined,
    source: "webhook",
  };
}

export async function GET(request: Request) {
  try {
    const apiKey = process.env.FATHOM_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "FATHOM_API_KEY not configured" }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const createdAfter = searchParams.get("created_after") ?? undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 50);

    const url = new URL("https://api.fathom.ai/external/v1/meetings");
    url.searchParams.set("include_summary", "true");
    url.searchParams.set("include_transcript", "true");
    url.searchParams.set("include_action_items", "true");
    if (createdAfter) url.searchParams.set("created_after", createdAfter);
    url.searchParams.set("limit", String(limit));

    const res = await fetch(url.toString(), {
      headers: { "X-Api-Key": apiKey },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[Fathom meetings] API error:", res.status, errText);
      return NextResponse.json(
        { error: `Fathom API error: ${res.status}` },
        { status: res.status >= 500 ? 502 : 400 }
      );
    }

    const data = (await res.json()) as { items?: FathomMeeting[] };
    const items = Array.isArray(data.items) ? data.items : [];
    const meetings = items.map((m, i) => fathomToPayload(m, i));

    return NextResponse.json({ meetings });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Fathom meetings] Error:", msg);
    return NextResponse.json({ error: msg || "Internal server error" }, { status: 500 });
  }
}
