import { NextResponse } from "next/server";

type TaskItem = {
  task_title?: string;
  owner?: string;
  task_url?: string;
};

type NotifySlackBody = {
  meeting_title?: string;
  date?: string;
  tasks?: TaskItem[];
  /** @deprecated Prefer email_subject + email_body; kept for optional link in Slack */
  gmail_link?: string;
  project_url?: string;
  email_subject?: string;
  email_body?: string;
};

const MRKDWN_CHUNK = 2800;

/** Slack mrkdwn-safe (avoid unintended formatting in user content). */
function escapeMrkdwn(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function chunkText(s: string, max: number): string[] {
  const t = s.trim();
  if (!t) return [];
  const parts: string[] = [];
  for (let i = 0; i < t.length; i += max) {
    parts.push(t.slice(i, i + max));
  }
  return parts;
}

export async function POST(request: Request) {
  try {
    let body: NotifySlackBody;
    try {
      body = (await request.json()) as NotifySlackBody;
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }
    const meeting_title = body.meeting_title ?? "";
    const date = body.date ?? "";
    const tasks = Array.isArray(body.tasks) ? body.tasks : [];
    const gmail_link = body.gmail_link ?? "";
    const project_url = body.project_url ?? "";
    const email_subject = (body.email_subject ?? "").trim();
    const email_body = (body.email_body ?? "").trim();

    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      return NextResponse.json(
        { success: false, error: "SLACK_WEBHOOK_URL not configured" },
        { status: 200 }
      );
    }

    const actionItemsText =
      tasks.length > 0
        ? tasks
            .map(
              (t) =>
                `• ${t.task_url ? `<${t.task_url}|${escapeMrkdwn(t.task_title ?? "Task")}>` : escapeMrkdwn(t.task_title ?? "Task")} (${escapeMrkdwn(t.owner ?? "Unassigned")})`
            )
            .join("\n")
        : "No tasks linked (add Asana tasks or push from the tool first).";

    const blocks: Array<Record<string, unknown>> = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `Meeting to Actions: ${meeting_title.slice(0, 240)}`,
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Date:* ${escapeMrkdwn(date || "—")}` },
          { type: "mrkdwn", text: `*Tasks in message:* ${tasks.length}` },
          ...(project_url
            ? [{ type: "mrkdwn" as const, text: `*Asana project:* <${project_url}|Open project>` }]
            : []),
          ...(gmail_link
            ? [{ type: "mrkdwn" as const, text: `*Gmail draft (optional):* <${gmail_link}|Open draft>` }]
            : []),
        ],
      },
      { type: "divider" },
    ];

    if (email_subject || email_body) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Client email — Subject*\n${escapeMrkdwn(email_subject || "(no subject)")}`,
        },
      });
      const bodyChunks = chunkText(email_body || "(empty body)", MRKDWN_CHUNK);
      if (bodyChunks.length === 0) {
        blocks.push({
          type: "section",
          text: { type: "mrkdwn", text: "*Client email — Body*\n_(empty)_" },
        });
      } else {
        for (let i = 0; i < bodyChunks.length; i++) {
          const label =
            bodyChunks.length > 1 ? `*Client email — Body (part ${i + 1}/${bodyChunks.length})*` : "*Client email — Body*";
          const safe = bodyChunks[i].replace(/```/g, "`\u200b``");
          blocks.push({
            type: "section",
            text: {
              type: "mrkdwn",
              text: `${label}\n\`\`\`\n${safe}\n\`\`\``,
            },
          });
        }
      }
      blocks.push({ type: "divider" });
    }

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Action items (Asana):*\n${actionItemsText}`,
      },
    });

    const payload = {
      text: `${email_subject.slice(0, 200) || "Client email"} — ${meeting_title.slice(0, 120)}`,
      blocks,
    };

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[Notify Slack] Slack API error:", res.status, errText);
      return NextResponse.json({
        success: false,
        error: "Slack notification failed",
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Notify Slack] Error:", msg);
    return NextResponse.json({
      success: false,
      error: "Slack notification failed",
    });
  }
}
