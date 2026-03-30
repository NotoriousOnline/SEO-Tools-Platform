import { NextResponse } from "next/server";
import crypto from "crypto";
import { setLatestMeeting, type MeetingPayload } from "@/lib/meetingStore";

function verifySignature(rawBody: string, headers: Headers): boolean {
  try {
    const secret = process.env.FATHOM_WEBHOOK_SECRET;
    if (!secret) return false;

    const xFathom =
      headers.get("x-fathom-signature") ?? headers.get("X-Fathom-Signature");
    if (xFathom) {
      const expected = crypto
        .createHmac("sha256", secret)
        .update(rawBody)
        .digest("hex");
      try {
        const receivedBuf = Buffer.from(xFathom, "hex");
        const expectedBuf = Buffer.from(expected, "hex");
        if (receivedBuf.length !== expectedBuf.length) return false;
        return crypto.timingSafeEqual(receivedBuf, expectedBuf);
      } catch {
        const expectedB64 = crypto
          .createHmac("sha256", secret)
          .update(rawBody)
          .digest("base64");
        try {
          const receivedBuf = Buffer.from(xFathom, "base64");
          const expectedBuf = Buffer.from(expectedB64, "base64");
          if (receivedBuf.length !== expectedBuf.length) return false;
          return crypto.timingSafeEqual(receivedBuf, expectedBuf);
        } catch {
          return false;
        }
      }
    }

    const webhookId = headers.get("webhook-id");
    const webhookTimestamp = headers.get("webhook-timestamp");
    const webhookSignature = headers.get("webhook-signature");
    if (webhookId && webhookTimestamp && webhookSignature) {
      const timestamp = parseInt(webhookTimestamp, 10);
      if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300)
        return false;
      const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;
      let secretBytes: Buffer;
      try {
        secretBytes = secret.startsWith("whsec_")
          ? Buffer.from(secret.split("_")[1], "base64")
          : Buffer.from(secret, "utf8");
      } catch {
        return false;
      }
      const expected = crypto
        .createHmac("sha256", secretBytes)
        .update(signedContent)
        .digest("base64");
      const sigs = webhookSignature
        .split(" ")
        .map((s) => (s.includes(",") ? s.split(",")[1] : s));
      for (const sig of sigs) {
        try {
          const sigBuf = Buffer.from(sig, "base64");
          const expectedBuf = Buffer.from(expected, "base64");
          if (sigBuf.length === expectedBuf.length && sigBuf.length > 0) {
            if (crypto.timingSafeEqual(sigBuf, expectedBuf)) return true;
          }
        } catch {
          // skip invalid signature
        }
      }
      return false;
    }

    return false;
  } catch {
    return false;
  }
}

function extractPayload(data: unknown): MeetingPayload {
  const obj = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const arr = (x: unknown): string[] =>
    Array.isArray(x) ? x.map((i) => String(i ?? "")) : [];
  const str = (x: unknown): string => (typeof x === "string" ? x : "");

  const meetingUrls: string[] = [];
  const urlFields = [
    obj.recording_url,
    obj.share_url,
    obj.meeting_url,
    obj.url,
    obj.recording_link,
    obj.link,
  ];
  for (const u of urlFields) {
    const s = str(u);
    if (s && s.startsWith("http") && !meetingUrls.includes(s)) meetingUrls.push(s);
  }

  return {
    meeting_title: str(obj.meeting_title ?? obj.title ?? obj.name ?? ""),
    date: str(obj.date ?? obj.created_at ?? obj.timestamp ?? new Date().toISOString()),
    participants: arr(obj.participants ?? obj.attendees ?? obj.participant_names ?? []),
    summary: str(obj.summary ?? ""),
    action_items: arr(obj.action_items ?? obj.action_items_list ?? []),
    transcript: str(obj.transcript ?? ""),
    meeting_urls: meetingUrls.length > 0 ? meetingUrls : undefined,
  };
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();

    console.log("[Fathom webhook] Incoming payload:", rawBody);

    if (!verifySignature(rawBody, request.headers)) {
      console.error("[Fathom webhook] Signature verification failed");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let data: unknown;
    try {
      data = JSON.parse(rawBody);
    } catch {
      data = {};
    }

    const payload = extractPayload(data);
    setLatestMeeting(payload);

    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[Fathom webhook] Error:", message, stack);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
