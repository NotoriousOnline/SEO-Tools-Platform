import { NextResponse } from "next/server";
import { callClaude } from "@/lib/anthropic";

const COMBINED_JSON_SHAPE = `Return ONLY valid JSON with no markdown and no code fences, in this exact shape:
{
  "email_draft": {
    "subject": string,
    "greeting": string,
    "summary_bullets": string[],
    "decisions": string[],
    "next_steps": string[],
    "closing": string
  },
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
}`;

const TASK1_EMAIL = `TASK 1 — email_draft:
You are a professional meeting summarizer writing on behalf of an agency.
Extract a concise, client-ready email summary from the meeting content provided.
Tone: professional, warm, concise.
Only include content explicitly discussed. Never hallucinate.`;

const TASK2_ACTIONS_EXPLICIT_ONLY = `TASK 2 — actions array:
Extract ONLY EXPLICIT action items—directly stated commitments, assignments, or deadlines.

Rules:
- Extract from both Summary and Transcript (Transcript is optional but use it when provided)
- Include ONLY explicitly stated items (e.g. "I will...", "we need to...", "let's...", "assign X to Y")
- Never infer or add implied follow-ups
- Split compound actions into individual tasks
- Set owner to Unassigned if not mentioned
- Convert implied deadlines to real date strings
- Separate client actions from internal team actions using related_to_client
- Do NOT prepend [HIGH], [MEDIUM], or [LOW] to task_title — priority is set via a separate field`;

const TASK2_ACTIONS_EXPLICIT_AND_IMPLICIT = `TASK 2 — actions array:
Extract BOTH explicit and implicit operational follow-ups from the Summary and Transcript.

Extraction scope:
- EXPLICIT: Directly stated commitments, assignments, deadlines, or "we need to" / "I will" / "let's" statements
- IMPLICIT: Logical next steps inferred from discussion tone, context, decisions made, or implied commitments

Rules:
- Extract from both Summary and Transcript (Transcript is optional but use it when provided for richer context)
- Split compound actions into individual tasks
- Set owner to Unassigned if not mentioned
- Convert implied deadlines to real date strings (e.g. by next Friday becomes an actual date)
- For implicit items: base them on clear inference from the discussion—do not invent unrelated tasks
- Include operational follow-ups that are logically required by decisions or commitments made
- Separate client actions from internal team actions using related_to_client
- Do NOT prepend [HIGH], [MEDIUM], or [LOW] to task_title — priority is set via a separate field`;

function buildCombinedSystemPrompt(
  extractionMode: "explicit_only" | "explicit_and_implicit"
): string {
  const task2 =
    extractionMode === "explicit_only"
      ? TASK2_ACTIONS_EXPLICIT_ONLY
      : TASK2_ACTIONS_EXPLICIT_AND_IMPLICIT;
  return [
    "You perform TWO tasks on the same meeting in ONE response (one API round-trip).",
    COMBINED_JSON_SHAPE,
    "",
    TASK1_EMAIL,
    "",
    task2,
  ].join("\n");
}

/** Extract JSON from Claude response — handles markdown fences, extra text, trailing commas. */
function extractJson(text: string): string {
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  } else {
    cleaned = cleaned
      .split("\n")
      .filter((line) => !line.trim().startsWith("```"))
      .join("\n")
      .trim();
  }
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) {
    cleaned = objMatch[0];
  }
  cleaned = cleaned.replace(/,(\s*[}\]])/g, "$1");
  return cleaned;
}

/** Returns parsed data or throws if JSON is malformed (non-empty response). */
function parseJsonOrThrow(text: string): unknown {
  const cleaned = extractJson(text);
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

    const systemPrompt = buildCombinedSystemPrompt(extractionMode);

    let raw: string;
    try {
      raw = await callClaude(systemPrompt, userMessage, { maxTokens: 4096 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Process] Claude combined call failed:", msg);
      return NextResponse.json(
        { error: `Meeting processing failed: ${msg}` },
        { status: 500 }
      );
    }

    let parsed: { email_draft?: unknown; actions?: unknown[] };
    try {
      parsed = parseJsonOrThrow(raw) as { email_draft?: unknown; actions?: unknown[] };
    } catch {
      return NextResponse.json(
        { error: "Claude returned malformed JSON (email + actions)" },
        { status: 500 }
      );
    }

    const emailDraft = parsed?.email_draft ?? null;
    const actions = Array.isArray(parsed?.actions) ? parsed.actions : [];

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
