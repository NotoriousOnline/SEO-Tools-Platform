import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    let body: { password?: string };
    try {
      body = (await request.json()) as { password?: string };
    } catch {
      return NextResponse.json({ success: false }, { status: 400 });
    }

    const password = typeof body.password === "string" ? body.password : "";

    const expectedPassword = process.env.TOOL_PASSWORD?.replace(/^\uFEFF/, "").trim();

    if (!expectedPassword) {
      console.warn("[Verify password] TOOL_PASSWORD env var is not set");
      return NextResponse.json(
        { success: false, error: "Password protection not configured" },
        { status: 500 }
      );
    }

    if (password === expectedPassword) {
      return NextResponse.json({ success: true, token: "authenticated" });
    }

    return NextResponse.json({ success: false }, { status: 401 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Verify password] Error:", msg);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
