import { NextResponse } from "next/server";
import { google } from "googleapis";

const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.compose";

function base64UrlEncode(str: string): string {
  return Buffer.from(str, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function buildRfc2822Message(subject: string, body: string): string {
  const lines = [
    "To: ",
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ];
  return lines.join("\r\n");
}

export async function POST(request: Request) {
  try {
    let body: { subject?: string; body?: string };
    try {
      body = (await request.json()) as { subject?: string; body?: string };
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }
    const subject = String(body.subject ?? "");
    const bodyText = String(body.body ?? "");

    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      return NextResponse.json(
        {
          error:
            "Missing Gmail OAuth credentials. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN in .env.local",
        },
        { status: 500 }
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      "urn:ietf:wg:oauth:2.0:oob"
    );

    oauth2Client.setCredentials({ refresh_token: refreshToken });

    let accessToken: string;
    try {
      const { token } = await oauth2Client.getAccessToken();
      accessToken = token ?? "";
      if (!accessToken) {
        throw new Error("Failed to obtain access token");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Create draft] Auth failed:", msg);
      return NextResponse.json(
        {
          error: `Gmail authentication failed. Token may be expired or invalid. ${msg}`,
        },
        { status: 401 }
      );
    }

    const rawMessage = buildRfc2822Message(subject, bodyText);
    const encoded = base64UrlEncode(rawMessage);

    const res = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/drafts",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: { raw: encoded } }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("[Create draft] Gmail API error:", res.status, errText);
      return NextResponse.json(
        {
          error: `Gmail API error: ${errText || res.statusText}`,
        },
        { status: res.status >= 500 ? 502 : res.status }
      );
    }

    const data = (await res.json()) as { id?: string };
    const draftId = data.id ?? "";

    return NextResponse.json({
      draft_id: draftId,
      gmail_link: `https://mail.google.com/mail/#drafts/${draftId}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Create draft] Error:", msg);
    return NextResponse.json(
      { error: msg || "Internal server error" },
      { status: 500 }
    );
  }
}
