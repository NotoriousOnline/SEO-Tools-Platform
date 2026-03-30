import { NextResponse } from "next/server";
import { describeFetchError, serverFetchOrigin } from "@/lib/serverFetch";

export const maxDuration = 120;

export async function GET(request: Request) {
  const base = serverFetchOrigin(request.url);

  console.log("[article-title-discovery/run] Step 1: Fetching articles...");
  let fetchRes: Response;
  try {
    fetchRes = await fetch(`${base}/api/article-title-discovery/fetch-articles`);
  } catch (err) {
    console.error("[article-title-discovery/run] Fetch articles network error:", err);
    return NextResponse.json(
      {
        success: false,
        error: `Could not call fetch-articles: ${describeFetchError(err)}. If you use npm run dev, ensure the app is running and try 127.0.0.1 instead of localhost.`,
      },
      { status: 502 }
    );
  }
  if (!fetchRes.ok) {
    console.error("[article-title-discovery/run] Fetch articles failed:", fetchRes.status);
    return NextResponse.json(
      { success: false, error: "Fetch articles failed" },
      { status: 502 }
    );
  }
  const articles = await fetchRes.json();
  console.log("[article-title-discovery/run] Fetched", articles.length, "articles");

  if (articles.length === 0) {
    return NextResponse.json({
      success: true,
      count: 0,
      results: [],
    });
  }

  console.log("[article-title-discovery/run] Step 2: Generating titles...");
  let generateRes: Response;
  try {
    generateRes = await fetch(`${base}/api/article-title-discovery/generate-titles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articles }),
    });
  } catch (err) {
    console.error("[article-title-discovery/run] Generate titles network error:", err);
    return NextResponse.json(
      { success: false, error: `Could not call generate-titles: ${describeFetchError(err)}` },
      { status: 502 }
    );
  }
  if (!generateRes.ok) {
    console.error("[article-title-discovery/run] Generate titles failed:", generateRes.status);
    return NextResponse.json(
      { success: false, error: "Generate titles failed" },
      { status: 502 }
    );
  }
  const results = await generateRes.json();
  console.log("[article-title-discovery/run] Generated", results.length, "titles");

  if (results.length === 0) {
    return NextResponse.json({
      success: true,
      count: 0,
      results: [],
    });
  }

  console.log("[article-title-discovery/run] Step 3: Sending to Slack...");
  let slackRes: Response;
  try {
    slackRes = await fetch(`${base}/api/article-title-discovery/send-to-slack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ results }),
    });
  } catch (err) {
    console.error("[article-title-discovery/run] Slack step network error:", err);
    return NextResponse.json(
      { success: false, error: `Could not call send-to-slack: ${describeFetchError(err)}` },
      { status: 502 }
    );
  }
  if (!slackRes.ok) {
    const errBody = await slackRes.json().catch(() => ({}));
    console.error("[article-title-discovery/run] Send to Slack failed:", slackRes.status, errBody);
    return NextResponse.json(
      { success: false, error: "Send to Slack failed" },
      { status: 502 }
    );
  }
  const slackData = await slackRes.json();
  console.log("[article-title-discovery/run] Sent", slackData.count, "to Slack");

  return NextResponse.json({
    success: true,
    count: results.length,
    results,
  });
}
