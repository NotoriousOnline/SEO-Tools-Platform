import { NextResponse } from "next/server";
import { errorMessage, serverLog } from "@/lib/serverLog";
import { syncInternalLinksFromWordPress } from "@/lib/siteLinkLibrary";
import { WP_TOOL_SCOPE } from "@/lib/wpSites";

/** Large sites (2000+ posts) need many sequential WP requests; Pro plan allows up to 300s. */
export const maxDuration = 300;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { count } = await syncInternalLinksFromWordPress(id, WP_TOOL_SCOPE.contentProduction);
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    const msg = errorMessage(err);
    void serverLog({
      level: "error",
      source: "content-production/sync-internal-links",
      message: `${id}: ${msg}`,
    });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
