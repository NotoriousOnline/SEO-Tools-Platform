import { NextResponse } from "next/server";
import { deleteSite, getSiteById, updateSite, type UpdateSiteData, type WPToolScope } from "@/lib/wpSites";

const MASKED_PASSWORD = "••••••••";

function maskSite<T extends { app_password?: string }>(site: T): Omit<T, "app_password"> & { app_password: string } {
  return { ...site, app_password: MASKED_PASSWORD };
}

export async function handleSiteDELETE(id: string, scope: WPToolScope) {
  try {
    await deleteSite(id, scope);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[sites] DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete site" }, { status: 500 });
  }
}

export async function handleSitePUT(request: Request, id: string, scope: WPToolScope) {
  try {
    const body = await request.json();

    const data: UpdateSiteData = {};
    if (body.name != null) data.name = body.name;
    if (body.url != null) data.url = body.url;
    if (body.username != null) data.username = body.username;
    if (body.app_password != null) data.app_password = body.app_password;
    if (body.tone_prompt != null) data.tone_prompt = body.tone_prompt;

    await updateSite(id, data, scope);
    const site = await getSiteById(id, scope);
    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }
    return NextResponse.json(maskSite(site));
  } catch (err) {
    console.error("[sites] PUT error:", err);
    return NextResponse.json({ error: "Failed to update site" }, { status: 500 });
  }
}
