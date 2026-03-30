import { NextResponse } from "next/server";
import { LOGS_COOKIE_NAME, signLogsSession } from "@/lib/logsSession";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const password = process.env.LOGS_VIEWER_PASSWORD?.trim();
  if (!password) {
    return NextResponse.json(
      { error: "Logs viewer is disabled (set LOGS_VIEWER_PASSWORD on the server)." },
      { status: 503 }
    );
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.password !== "string" || body.password !== password) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = signLogsSession(password);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(LOGS_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
