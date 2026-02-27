import { NextResponse } from "next/server";

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }); // e.g. "24 February 2026"
  } catch {
    return dateStr; // fallback to original if parsing fails
  }
}

type CreateProjectBody = {
  meeting_title: string;
  date: string;
};

export async function POST(request: Request) {
  // VERCEL: ensure ASANA_TEAM_GID=1213384492335420 is set in environment variables
  console.log("create-project called");
  console.log("ASANA_ACCESS_TOKEN present:", !!process.env.ASANA_ACCESS_TOKEN);
  console.log("ASANA_WORKSPACE_GID:", process.env.ASANA_WORKSPACE_GID);
  console.log("ASANA_TEAM_GID:", process.env.ASANA_TEAM_GID);

  const token = process.env.ASANA_ACCESS_TOKEN;
  const workspaceGid = process.env.ASANA_WORKSPACE_GID;
  const teamGid = process.env.ASANA_TEAM_GID;
  const fallbackProjectGid = process.env.ASANA_PROJECT_GID;
  const priorityFieldGid = process.env.ASANA_PRIORITY_FIELD_GID;
  const statusFieldGid = process.env.ASANA_STATUS_FIELD_GID;

  if (!token || !workspaceGid) {
    console.error("[Create project] Missing ASANA_ACCESS_TOKEN or ASANA_WORKSPACE_GID");
    return NextResponse.json(
      {
        success: false,
        error: "Missing ASANA_ACCESS_TOKEN or ASANA_WORKSPACE_GID",
        fallback_project_gid: fallbackProjectGid ?? undefined,
      },
      { status: 500 }
    );
  }

  try {
    let body: CreateProjectBody;
    try {
      body = (await request.json()) as CreateProjectBody;
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body", fallback_project_gid: fallbackProjectGid ?? undefined },
        { status: 400 }
      );
    }

    const meeting_title = String(body.meeting_title ?? "").trim();
    const dateRaw = String(body.date ?? "").trim();
    const date = formatDate(dateRaw);

    if (!meeting_title || !dateRaw) {
      return NextResponse.json(
        {
          success: false,
          error: "meeting_title and date are required",
          fallback_project_gid: fallbackProjectGid ?? undefined,
        },
        { status: 400 }
      );
    }

    const projectBody: Record<string, unknown> = {
      name: meeting_title + " — " + date,
      workspace: process.env.ASANA_WORKSPACE_GID,
      default_view: "list",
      notes: "Auto-created by Meeting to Actions on " + date,
      public: false,
    };

    if (process.env.ASANA_TEAM_GID) {
      projectBody.team = process.env.ASANA_TEAM_GID;
    }

    const response = await fetch("https://app.asana.com/api/1.0/projects", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + process.env.ASANA_ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: projectBody }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Asana project creation failed:", response.status, errorText);
      return NextResponse.json(
        {
          success: false,
          error: "Asana returned " + response.status,
          detail: errorText,
          fallback_project_gid: fallbackProjectGid ?? undefined,
        },
        { status: 200 }
      );
    }

    const createData = (await response.json()) as { data?: { gid?: string; name?: string } };
    const projectGid = createData.data?.gid;
    const projectNameFromApi = createData.data?.name ?? meeting_title + " — " + date;

    if (!projectGid) {
      console.error("[Create project] No project GID in Asana response");
      return NextResponse.json(
        {
          success: false,
          error: "No project GID in Asana response",
          fallback_project_gid: fallbackProjectGid ?? undefined,
        },
        { status: 500 }
      );
    }

    type PriorityGids = {
      priority_field_gid: string;
      priority_high_gid: string;
      priority_medium_gid: string;
      priority_low_gid: string;
    };

    let createdPriorityGids: PriorityGids | null = null;

    const findExistingPriorityAndAdd = async (): Promise<PriorityGids | null> => {
      const listRes = await fetch(
        `https://app.asana.com/api/1.0/workspaces/${workspaceGid}/custom_fields?opt_fields=name,enum_options,enum_options.gid,enum_options.name`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!listRes.ok) return null;
      const listJson = (await listRes.json()) as { data?: Array<{ gid?: string; name?: string; enum_options?: Array<{ gid?: string; name?: string }> }> };
      const fields = listJson.data ?? [];
      const priorityField = fields.find((f) => f.name === "Priority" && f.gid);
      if (!priorityField?.gid) return null;
      let opts = priorityField.enum_options ?? [];
      if (opts.length === 0) {
        const getRes = await fetch(`https://app.asana.com/api/1.0/custom_fields/${priorityField.gid}?opt_fields=enum_options,enum_options.gid,enum_options.name`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (getRes.ok) {
          const getJson = (await getRes.json()) as { data?: { enum_options?: Array<{ gid?: string; name?: string }> } };
          opts = getJson.data?.enum_options ?? [];
        }
      }
      const byName: Record<string, string> = {};
      for (const o of opts) {
        if (o.gid && o.name) byName[o.name] = o.gid;
      }
      const high = byName.High ?? opts[0]?.gid;
      const medium = byName.Medium ?? opts[1]?.gid ?? high;
      const low = byName.Low ?? opts[2]?.gid ?? medium;
      if (!high || !medium || !low) return null;
      const addRes = await fetch(
        `https://app.asana.com/api/1.0/projects/${projectGid}/addCustomFieldSetting`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ data: { custom_field: priorityField.gid, is_important: true } }),
        }
      );
      if (!addRes.ok) {
        console.warn("[Create project] Could not add existing Priority to project:", addRes.status, await addRes.text());
      }
      return {
        priority_field_gid: priorityField.gid,
        priority_high_gid: high,
        priority_medium_gid: medium,
        priority_low_gid: low,
      };
    };

    const createAndAddPriorityField = async (): Promise<PriorityGids | null> => {
      // Step 1: Create workspace-level Priority field via POST /custom_fields
      const createRes = await fetch("https://app.asana.com/api/1.0/custom_fields", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: {
            workspace: workspaceGid,
            resource_subtype: "enum",
            name: "Priority",
            enum_options: [
              { name: "High", color: "red" },
              { name: "Medium", color: "yellow" },
              { name: "Low", color: "green" },
            ],
          },
        }),
      });
      if (!createRes.ok) {
        const errText = await createRes.text();
        console.warn("[Create project] Could not create Priority field:", createRes.status, errText, "— trying existing workspace field");
        return findExistingPriorityAndAdd();
      }
      const createJson = (await createRes.json()) as {
        data?: { gid?: string; enum_options?: Array<{ gid?: string; name?: string }> };
      };
      const cfGid = createJson.data?.gid;
      if (!cfGid) return null;
      let opts = Array.isArray(createJson.data?.enum_options) ? createJson.data.enum_options : [];
      if (opts.length === 0) {
        const getRes = await fetch(`https://app.asana.com/api/1.0/custom_fields/${cfGid}?opt_fields=enum_options,enum_options.gid,enum_options.name`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (getRes.ok) {
          const getJson = (await getRes.json()) as { data?: { enum_options?: Array<{ gid?: string; name?: string }> } };
          opts = getJson.data?.enum_options ?? [];
        }
      }
      const byName: Record<string, string> = {};
      for (const o of opts) {
        if (o.gid && o.name) byName[o.name] = o.gid;
      }
      const high = byName.High ?? opts[0]?.gid;
      const medium = byName.Medium ?? opts[1]?.gid ?? high;
      const low = byName.Low ?? opts[2]?.gid ?? medium;
      if (!high || !medium || !low) return null;

      // Step 2: Add the field to the project
      const addRes = await fetch(
        `https://app.asana.com/api/1.0/projects/${projectGid}/addCustomFieldSetting`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            data: {
              custom_field: cfGid,
              is_important: true,
            },
          }),
        }
      );
      if (!addRes.ok) {
        const errText = await addRes.text();
        console.warn("[Create project] Created Priority field but could not add to project:", addRes.status, errText);
        // Still return GIDs so create-tasks can set values; field may be added manually
      }
      return {
        priority_field_gid: cfGid,
        priority_high_gid: high,
        priority_medium_gid: medium,
        priority_low_gid: low,
      };
    };

    // Step A — Attach Priority field (try env var first, then create workspace-level if it fails)
    if (priorityFieldGid) {
      try {
        const res = await fetch(
          `https://app.asana.com/api/1.0/projects/${projectGid}/addCustomFieldSetting`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              data: {
                custom_field: priorityFieldGid,
                is_important: true,
              },
            }),
          }
        );
        if (res.ok) {
          console.log(`[Create project] Priority field attached to project: ${projectGid}`);
          const highGid = process.env.ASANA_PRIORITY_HIGH_GID;
          const mediumGid = process.env.ASANA_PRIORITY_MEDIUM_GID;
          const lowGid = process.env.ASANA_PRIORITY_LOW_GID;
          if (highGid && mediumGid && lowGid) {
            createdPriorityGids = {
              priority_field_gid: priorityFieldGid,
              priority_high_gid: highGid,
              priority_medium_gid: mediumGid,
              priority_low_gid: lowGid,
            };
          }
        } else {
          const errText = await res.text();
          console.warn(`[Create project] Could not attach Priority field (${res.status}) — creating workspace-level Priority field`);
          createdPriorityGids = await createAndAddPriorityField();
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[Create project] Could not attach Priority field — ${msg}`);
        createdPriorityGids = await createAndAddPriorityField();
      }
    }
    if (!createdPriorityGids && !priorityFieldGid) {
      createdPriorityGids = await createAndAddPriorityField();
    }
    if (!createdPriorityGids && priorityFieldGid) {
      createdPriorityGids = await findExistingPriorityAndAdd();
    }

    // Step B — Attach Status field
    if (statusFieldGid) {
      try {
        const res = await fetch(
          `https://app.asana.com/api/1.0/projects/${projectGid}/addCustomFieldSetting`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              data: {
                custom_field: statusFieldGid,
                is_important: true,
              },
            }),
          }
        );
        if (res.ok) {
          console.log(`[Create project] Status field attached to project: ${projectGid}`);
        } else {
          const errText = await res.text();
          console.warn(`[Create project] Warning: could not attach Status field — ${errText}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[Create project] Warning: could not attach Status field — ${msg}`);
      }
    }

    const projectUrl = `https://app.asana.com/0/${projectGid}/list`;

    if (createdPriorityGids) {
      console.log("[Create project] Returning priority GIDs for create-tasks:", Object.keys(createdPriorityGids));
    } else {
      console.warn("[Create project] No priority GIDs returned — tasks will not have Priority set");
    }

    return NextResponse.json({
      success: true,
      project_gid: projectGid,
      project_name: projectNameFromApi,
      project_url: projectUrl,
      ...(createdPriorityGids ? createdPriorityGids : {}),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Create project] Unexpected error:", msg);
    return NextResponse.json(
      {
        success: false,
        error: msg || "Internal server error",
        fallback_project_gid: fallbackProjectGid ?? undefined,
      },
      { status: 500 }
    );
  }
}
