import { NextResponse } from "next/server";
import { callClaude } from "@/lib/anthropic";

const EMAIL_SYSTEM_PROMPT = `You are a professional meeting summarizer writing on behalf of an agency.
Extract a concise, client-ready email summary from the meeting content provided.
Return ONLY valid JSON with no markdown and no code fences, in this exact shape:
{
  "subject": string,
  "greeting": string,
  "summary_bullets": string[],
  "decisions": string[],
  "next_steps": string[],
  "closing": string
}
Tone: professional, warm, concise.
Only include content explicitly discussed. Never hallucinate.`;

const ACTIONS_PROMPT_EXPLICIT_ONLY = `You are an expert at extracting action items from meeting content.
Extract ONLY EXPLICIT action items—directly stated commitments, assignments, or deadlines.

Return ONLY valid JSON with no markdown and no code fences, in this exact shape:
{
  "actions": [
    {
      "task_title": string,
      "description": string,
      "owner": string,
      "due_date": string,
      "priority": "High" | "Medium" | "Low",
      "related_to_client": boolean
    }
  ]
}

Rules:
- Extract from both Summary and Transcript (Transcript is optional but use it when provided)
- Include ONLY explicitly stated items (e.g. "I will...", "we need to...", "let's...", "assign X to Y")
- Never infer or add implied follow-ups
- Split compound actions into individual tasks
- Set owner to Unassigned if not mentioned
- Convert implied deadlines to real date strings
- Separate client actions from internal team actions using related_to_client`;

const ACTIONS_PROMPT_EXPLICIT_AND_IMPLICIT = `You are an expert at extracting action items from meeting content.
Extract BOTH explicit and implicit operational follow-ups from the Summary and Transcript.

Return ONLY valid JSON with no markdown and no code fences, in this exact shape:
{
  "actions": [
    {
      "task_title": string,
      "description": string,
      "owner": string,
      "due_date": string,
      "priority": "High" | "Medium" | "Low",
      "related_to_client": boolean
    }
  ]
}

Extraction scope:
- EXPLICIT: Directly stated commitments, assignments, deadlines, or "we need to" / "I will" / "let's" statements
- IMPLICIT: Logical next steps inferred from discussion tone, context, decisions made, or implied commitments (e.g. if they agreed to a proposal, infer follow-up to implement it; if they discussed a problem, infer follow-up to resolve it)

Rules:
- Extract from both Summary and Transcript (Transcript is optional but use it when provided for richer context)
- Split compound actions into individual tasks
- Set owner to Unassigned if not mentioned
- Convert implied deadlines to real date strings (e.g. by next Friday becomes an actual date)
- For implicit items: base them on clear inference from the discussion—do not invent unrelated tasks
- Include operational follow-ups that are logically required by decisions or commitments made
- Separate client actions from internal team actions using related_to_client`;

function stripMarkdownFences(text: string): string {
  return text
    .split("\n")
    .filter((line) => !line.trim().startsWith("```"))
    .join("\n")
    .trim();
}

/** Returns parsed data or throws if JSON is malformed (non-empty response). */
function parseJsonOrThrow(text: string): unknown {
  const cleaned = stripMarkdownFences(text);
  if (!cleaned.trim()) return null;
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error("Claude returned malformed JSON");
  }
}

type ProcessBody = {
  meeting_title?: string;
  date?: string;
  participants?: string[];
  summary?: string;
  transcript?: string;
  extraction_mode?: "explicit_only" | "explicit_and_implicit";
};

const MOCK_MALFORMED_TITLE = "MOCK_MALFORMED_JSON";

export async function POST(request: Request) {
  try {
    let body: ProcessBody;
    try {
      body = (await request.json()) as ProcessBody;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }
    const meeting_title = body.meeting_title ?? "";

    // E2E test: simulate malformed Claude response
    if (meeting_title === MOCK_MALFORMED_TITLE) {
      return NextResponse.json(
        { error: "Claude returned malformed JSON for email summary" },
        { status: 500 }
      );
    }
    const date = body.date ?? "";
    const participants = Array.isArray(body.participants)
      ? body.participants
      : [];
    const summary = body.summary ?? "";
    const transcript = body.transcript ?? "";
    const extractionMode = body.extraction_mode ?? "explicit_and_implicit";
    const actionsPrompt =
      extractionMode === "explicit_only"
        ? ACTIONS_PROMPT_EXPLICIT_ONLY
        : ACTIONS_PROMPT_EXPLICIT_AND_IMPLICIT;

    const userMessage = [
      `Meeting: ${meeting_title}`,
      `Date: ${date}`,
      `Participants: ${participants.join(", ") || "N/A"}`,
      "",
      "Summary:",
      summary || "N/A",
      "",
      "Transcript:",
      transcript || "N/A",
    ].join("\n");

    let emailDraft: unknown = null;
    let actions: unknown[] = [];

    try {
      const emailResponse = await callClaude(EMAIL_SYSTEM_PROMPT, userMessage);
      try {
        emailDraft = parseJsonOrThrow(emailResponse);
      } catch {
        return NextResponse.json(
          { error: "Claude returned malformed JSON for email summary" },
          { status: 500 }
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Process] Claude email call failed:", msg);
      return NextResponse.json(
        { error: `Email summary failed: ${msg}` },
        { status: 500 }
      );
    }

    try {
      const actionsResponse = await callClaude(actionsPrompt, userMessage);
      let parsed: { actions?: unknown[] };
      try {
        parsed = parseJsonOrThrow(actionsResponse) as { actions?: unknown[] };
      } catch {
        return NextResponse.json(
          { error: "Claude returned malformed JSON for action extraction" },
          { status: 500 }
        );
      }
      actions = Array.isArray(parsed?.actions) ? parsed.actions : [];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Process] Claude actions call failed:", msg);
      return NextResponse.json(
        { error: `Action extraction failed: ${msg}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      email_draft: emailDraft,
      actions,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Process] Error:", msg);
    return NextResponse.json(
      { error: msg || "Internal server error" },
      { status: 500 }
    );
  }
}
