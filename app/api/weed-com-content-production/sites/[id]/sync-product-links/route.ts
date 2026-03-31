import { NextResponse } from "next/server";
import { errorMessage, serverLog } from "@/lib/serverLog";
import { syncProductInternalLinksFromWordPress } from "@/lib/siteLinkLibrary";
import { WP_TOOL_SCOPE } from "@/lib/wpSites";

export const maxDuration = 300;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { count } = await syncProductInternalLinksFromWordPress(id, WP_TOOL_SCOPE.weedComContentProduction);
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    const msg = errorMessage(err);
    void serverLog({
      level: "error",
      source: "weed-com/sync-product-links",
      message: `${id}: ${msg}`,
    });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
