import { NextResponse } from "next/server";
import { isInoreaderConfigured } from "@/lib/inoreaderClient";
import { RSS_FEEDS } from "@/lib/rssFeeds";

export const dynamic = "force-dynamic";

export type ArticleDiscoveryInfo = {
  primarySource: "inoreader" | "rss";
  rssFeedCount: number;
  inoreaderReady: boolean;
  /** Safe display label; set INOREADER_STREAM_LABEL to customize. */
  inoreaderDisplayLabel: string | null;
};

export async function GET(): Promise<NextResponse<ArticleDiscoveryInfo>> {
  const streamId = process.env.INOREADER_STREAM_ID?.trim();
  const customLabel = process.env.INOREADER_STREAM_LABEL?.trim();
  const inoreaderReady = isInoreaderConfigured() && Boolean(streamId);

  let inoreaderDisplayLabel: string | null = null;
  if (inoreaderReady) {
    inoreaderDisplayLabel =
      customLabel ??
      (streamId?.includes("/label/")
        ? decodeURIComponent(streamId.split("/label/").pop() ?? "Inoreader")
        : "Inoreader");
  }

  const body: ArticleDiscoveryInfo = {
    primarySource: inoreaderReady ? "inoreader" : "rss",
    rssFeedCount: RSS_FEEDS.length,
    inoreaderReady,
    inoreaderDisplayLabel,
  };
  return NextResponse.json(body);
}
