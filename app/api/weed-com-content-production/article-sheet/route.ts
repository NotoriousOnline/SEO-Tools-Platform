import { NextResponse } from "next/server";
import { parseArticleSheetRows, type ArticleSheetRow } from "@/lib/articleSheetCalendar";
import { fetchWeedArticleSheetValues } from "@/lib/googleSheetsWeedArticles";
import { errorMessage, serverLog } from "@/lib/serverLog";

/** List article rows from the Weed.com Learn Google Sheet (read-only). */
export async function GET() {
  try {
    const values = await fetchWeedArticleSheetValues();
    const rows: ArticleSheetRow[] = parseArticleSheetRows(values);
    return NextResponse.json({ rows });
  } catch (err) {
    const msg = errorMessage(err);
    void serverLog({
      level: "error",
      source: "weed-com/article-sheet",
      message: msg,
    });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
