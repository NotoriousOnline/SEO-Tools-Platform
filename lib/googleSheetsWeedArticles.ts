import { GoogleAuth } from "google-auth-library";

/**
 * Server-only: read the Weed.com Learn spreadsheet via Google Sheets API.
 * @see parseArticleSheetRows in ./articleSheetCalendar.ts
 */
async function getAccessTokenFromServiceAccount(): Promise<string> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON must be valid JSON");
  }
  const auth = new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const client = await auth.getClient();
  const access = await client.getAccessToken();
  if (!access.token) throw new Error("Failed to obtain Google access token for Sheets");
  return access.token;
}

/**
 * Reads the configured sheet. Use either:
 * - GOOGLE_SERVICE_ACCOUNT_JSON — share the doc with the service account email.
 * - GOOGLE_SHEETS_API_KEY — only if the spreadsheet is publicly readable.
 */
export async function fetchWeedArticleSheetValues(): Promise<string[][]> {
  const sheetId =
    process.env.WEED_ARTICLE_SHEET_ID?.trim() || "1O1oYFMgnhC8_O7Rp6ifngVXtLr7CfHWcIv2pTVySphI";
  const range = process.env.WEED_ARTICLE_SHEET_RANGE?.trim() || "Sheet1!A1:J5000";

  const urlPath = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    sheetId
  )}/values/${encodeURIComponent(range)}`;

  const apiKey = process.env.GOOGLE_SHEETS_API_KEY?.trim();
  const hasSA = !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();

  let res: Response;
  if (hasSA) {
    const token = await getAccessTokenFromServiceAccount();
    res = await fetch(urlPath, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 0 },
    });
  } else if (apiKey) {
    res = await fetch(`${urlPath}?key=${encodeURIComponent(apiKey)}`, { next: { revalidate: 0 } });
  } else {
    throw new Error(
      "Configure GOOGLE_SERVICE_ACCOUNT_JSON (recommended: share the sheet with the service account email) or GOOGLE_SHEETS_API_KEY for a publicly readable sheet."
    );
  }

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Google Sheets API ${res.status}: ${t.slice(0, 500)}`);
  }

  const data = (await res.json()) as { values?: string[][] };
  return data.values ?? [];
}
