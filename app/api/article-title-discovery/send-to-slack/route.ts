import { NextResponse } from "next/server";

type ResultItem = {
  suggested_title: string;
  source_title: string;
  source_url: string;
  source_name: string;
};

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function POST(request: Request) {
  const webhookUrl = process.env.ARTICLE_SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json(
      { success: false, error: "ARTICLE_SLACK_WEBHOOK_URL is not set" },
      { status: 500 }
    );
  }

  let body: { results?: ResultItem[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const results = Array.isArray(body.results) ? body.results : [];
  if (results.length === 0) {
    return NextResponse.json({ success: true, count: 0 });
  }

  const lines: string[] = [
    "📰 *green.org — Daily Title Ideas*",
    formatDate(),
    "━━━━━━━━━━━━━━━━━━━━",
    "",
  ];

  results.forEach((r, i) => {
    lines.push(`${i + 1}. ${r.suggested_title}`);
    lines.push(`   💡 Inspired by: ${r.source_title} (${r.source_name})`);
    lines.push(`   🔗 ${r.source_url}`);
    lines.push("");
  });

  const text = lines.join("\n").trim();

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[send-to-slack] Slack webhook error:", res.status, errText);
      return NextResponse.json(
        { success: false, error: `Slack webhook failed: ${res.status}` },
        { status: 502 }
      );
    }
  } catch (err) {
    console.error("[send-to-slack] Fetch error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to send to Slack" },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, count: results.length });
}
