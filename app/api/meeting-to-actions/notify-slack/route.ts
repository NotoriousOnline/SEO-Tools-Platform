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
  gmail_link?: string;
  project_url?: string;
};

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
                `• <${t.task_url ?? ""}|${t.task_title ?? "Task"}> (${t.owner ?? "Unassigned"})`
            )
            .join("\n")
        : "No tasks created";

    const payload = {
      text: `Meeting processed: ${meeting_title}`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `Meeting to Actions: ${meeting_title}`,
            emoji: true,
          },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Date:* ${date}` },
            { type: "mrkdwn", text: `*Tasks created:* ${tasks.length}` },
            {
              type: "mrkdwn",
              text: gmail_link
                ? `*Gmail draft:* <${gmail_link}|Open draft>`
                : "*Gmail draft:* N/A",
            },
            ...(project_url
              ? [{ type: "mrkdwn" as const, text: `*Asana Project:* <${project_url}|Open project>` }]
              : []),
          ],
        },
        { type: "divider" },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Action Items:*\n${actionItemsText}`,
          },
        },
      ],
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
