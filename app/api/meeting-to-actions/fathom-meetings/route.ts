import { NextResponse } from "next/server";
import type { MeetingPayload } from "@/lib/meetingStore";

export const maxDuration = 30; // seconds — requires Vercel Pro or above
export const dynamic = "force-dynamic"; // disable caching on this route

/** Fathom can be slow when include_summary + include_transcript + many meetings. Default 25s (under maxDuration). */
const FATHOM_FETCH_TIMEOUT_MS = Math.min(
  Math.max(1000, parseInt(process.env.FATHOM_FETCH_TIMEOUT_MS ?? "25000", 10)),
  29000
);

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
  console.log("fathom-meetings route called — API key present:", !!process.env.FATHOM_API_KEY);

  try {
    if (!process.env.FATHOM_API_KEY) {
      return NextResponse.json(
        { error: "FATHOM_API_KEY is not set in environment variables" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const createdAfter = searchParams.get("created_after") ?? undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 50);

    const url = new URL("https://api.fathom.ai/external/v1/meetings");
    url.searchParams.set("include_summary", "true");
    url.searchParams.set("include_transcript", "true");
    url.searchParams.set("include_action_items", "true");
    url.searchParams.set("limit", String(limit));
    if (createdAfter) url.searchParams.set("created_after", createdAfter);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FATHOM_FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        headers: { "X-Api-Key": process.env.FATHOM_API_KEY },
        signal: controller.signal,
      });
      clearTimeout(timeout);
    } catch (err: unknown) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === "AbortError") {
        const sec = Math.round(FATHOM_FETCH_TIMEOUT_MS / 1000);
        return NextResponse.json(
          {
            error: `Fathom API timed out after ${sec} seconds`,
            hint: "Fathom is often slow with summaries + transcripts; increase FATHOM_FETCH_TIMEOUT_MS (max ~29s) or lower the limit query param.",
          },
          { status: 504 }
        );
      }
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Fathom API error:", response.status, errorText);
      return NextResponse.json(
        { error: "Fathom API returned " + response.status, detail: errorText },
        { status: response.status }
      );
    }

    const data = (await response.json()) as { items?: FathomMeeting[] };
    const items = Array.isArray(data.items) ? data.items : [];
    const meetings = items.map((m, i) => fathomToPayload(m, i));

    return NextResponse.json({ meetings });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Fathom meetings] Unexpected error:", msg);
    return NextResponse.json(
      { error: "Unexpected error", detail: msg },
      { status: 500 }
    );
  }
}
