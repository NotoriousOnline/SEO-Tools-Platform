import { NextResponse } from "next/server";

type ActionItem = {
  task_title?: string;
  description?: string;
  owner?: string;
  due_date?: string;
  priority?: "High" | "Medium" | "Low";
  related_to_client?: boolean;
};

type CreateTasksBody = {
  actions: ActionItem[];
  meeting_title: string;
  date: string;
  project_gid?: string;
  priority_field_gid?: string;
  priority_high_gid?: string;
  priority_medium_gid?: string;
  priority_low_gid?: string;
};

function formatDueDate(dueDate: string | undefined): string | undefined {
  if (!dueDate || typeof dueDate !== "string") return undefined;
  const trimmed = dueDate.trim();
  if (!trimmed) return undefined;
  const match = trimmed.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) return match[0];
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return undefined;
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getPriorityEnumGid(
  priority: string,
  overrides?: { high?: string; medium?: string; low?: string }
): string | null {
  const high = overrides?.high ?? process.env.ASANA_PRIORITY_HIGH_GID;
  const medium = overrides?.medium ?? process.env.ASANA_PRIORITY_MEDIUM_GID;
  const low = overrides?.low ?? process.env.ASANA_PRIORITY_LOW_GID;
  switch (priority.toLowerCase()) {
    case "high":
      return high || null;
    case "medium":
      return medium || null;
    case "low":
      return low || null;
    default:
      return medium || null;
  }
}

export async function POST(request: Request) {
  try {
    let body: CreateTasksBody;
    try {
      body = (await request.json()) as CreateTasksBody;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }
    const actions = Array.isArray(body.actions) ? body.actions : [];
    const meeting_title = body.meeting_title ?? "";
    const date = body.date ?? "";
    const projectGidFromBody = typeof body.project_gid === "string" ? body.project_gid.trim() : "";
    const priorityOverrides =
      body.priority_field_gid && body.priority_high_gid && body.priority_medium_gid && body.priority_low_gid
        ? {
            field: body.priority_field_gid,
            high: body.priority_high_gid,
            medium: body.priority_medium_gid,
            low: body.priority_low_gid,
          }
        : null;

    console.log("[Create tasks] priorityOverrides from request:", priorityOverrides ? "present" : "null", "project_gid:", projectGidFromBody || "(env default)");

    const token = process.env.ASANA_ACCESS_TOKEN;
    const projectGid = projectGidFromBody || process.env.ASANA_PROJECT_GID;

    if (!token || !projectGid) {
      return NextResponse.json(
        { error: "Missing ASANA_ACCESS_TOKEN or ASANA_PROJECT_GID" },
        { status: 500 }
      );
    }

    const meetingContext = `\n\nMeeting: ${meeting_title} (${date})`;

    // VERCEL: ensure ASANA_STATUS_ON_TRACK_GID=1213384495537104 is set in environment variables
    console.log("[Create tasks] Priority env vars:", {
      ASANA_PRIORITY_FIELD_GID: !!process.env.ASANA_PRIORITY_FIELD_GID,
      ASANA_PRIORITY_HIGH_GID: !!process.env.ASANA_PRIORITY_HIGH_GID,
      ASANA_PRIORITY_MEDIUM_GID: !!process.env.ASANA_PRIORITY_MEDIUM_GID,
      ASANA_PRIORITY_LOW_GID: !!process.env.ASANA_PRIORITY_LOW_GID,
    });

    const createTask = async (
      action: ActionItem,
      includeCustomFields: boolean
    ): Promise<
      | { success: true; task_gid: string; task_url: string; task_title: string }
      | { success: false; error: string; task_title: string }
    > => {
      const priority = (action.priority ?? "Medium").toString();
      const task_title = String(action.task_title ?? "Untitled task").trim() || "Untitled task";
      const description = String(action.description ?? "");
      const due_date = formatDueDate(action.due_date);

      const priorityEnumGid = getPriorityEnumGid(priority, priorityOverrides ? { high: priorityOverrides.high, medium: priorityOverrides.medium, low: priorityOverrides.low } : undefined);
      const priorityFieldGid = priorityOverrides?.field ?? process.env.ASANA_PRIORITY_FIELD_GID;
      const statusFieldGid = process.env.ASANA_STATUS_FIELD_GID;
      const statusOnTrackGid = process.env.ASANA_STATUS_ON_TRACK_GID;

      const customFields: Record<string, string> = {};
      if (includeCustomFields) {
        if (priorityFieldGid && priorityEnumGid) {
          customFields[priorityFieldGid] = priorityEnumGid;
        }
        // Status field is project-specific — only include when using default project (no priorityOverrides = env default project)
        const useStatusField = statusFieldGid && statusOnTrackGid && !priorityOverrides;
        if (useStatusField) {
          customFields[statusFieldGid] = statusOnTrackGid;
        }
      }

      if (!priorityFieldGid || !priorityEnumGid) {
        console.warn(`[Create tasks] Priority field will be empty. priorityFieldGid=${!!priorityFieldGid} priorityEnumGid=${!!priorityEnumGid} task="${task_title}"`);
      }

      const data: Record<string, unknown> = {
        name: task_title,
        notes: description + meetingContext,
        projects: [projectGid],
        custom_fields: customFields,
      };

      if (due_date) {
        data.due_on = due_date;
      }

      const doFetch = async (): Promise<{ res: Response; resText: string }> => {
        const res = await fetch("https://app.asana.com/api/1.0/tasks", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ data }),
        });
        const resText = await res.text();
        return { res, resText };
      };

      let { res, resText } = await doFetch();
      const is429 = res.status === 429;
      const retryAfter = is429 ? parseInt(res.headers.get("Retry-After") ?? "60", 10) * 1000 : 0;
      if (is429 && retryAfter > 0) {
        console.warn(`[Create tasks] Rate limited (429), waiting ${retryAfter}ms before retry for: ${task_title}`);
        await new Promise((r) => setTimeout(r, Math.min(retryAfter, 60000)));
        const retried = await doFetch();
        res = retried.res;
        resText = retried.resText;
      }
      const isTransientError =
        res.status >= 500 ||
        (resText.includes("unexpected error") && resText.includes("phrase"));
      if (isTransientError) {
        await new Promise((r) => setTimeout(r, 2000));
        const retried = await doFetch();
        res = retried.res;
        resText = retried.resText;
      }

      if (!res.ok) {
        const isCustomFieldRejected =
          (res.status === 400 || res.status === 403 || res.status === 422) && includeCustomFields;
        if (isCustomFieldRejected) {
          console.warn(`[Create tasks] Custom field write blocked — Priority column will be empty. Asana error: ${resText}`);
          return createTask(action, false);
        }
        return {
          success: false,
          error: resText || `HTTP ${res.status}`,
          task_title,
        };
      }

      let json: { data?: { gid?: string } };
      try {
        json = JSON.parse(resText) as { data?: { gid?: string } };
      } catch {
        return {
          success: false,
          error: "Invalid response from Asana",
          task_title,
        };
      }
      const task_gid = json.data?.gid ?? "";
      const task_url = task_gid
        ? `https://app.asana.com/0/0/${task_gid}`
        : "";

      if (Object.keys(customFields).length > 0) {
        console.log(`[Create tasks] Task created with custom fields (Priority+Status): ${task_title}`);
      }

      return {
        success: true,
        task_gid,
        task_url,
        task_title,
      };
    };

    // Create tasks sequentially to avoid Asana's 15 concurrent POST limit
    const output: Array<
      | { success: true; task_gid: string; task_url: string; task_title: string }
      | { success: false; error: string; task_title: string }
    > = [];
    for (let i = 0; i < actions.length; i++) {
      const result = await createTask(actions[i], true);
      output.push(result);
      // Small delay between tasks to stay under concurrent limit
      if (i < actions.length - 1) {
        await new Promise((r) => setTimeout(r, 150));
      }
    }

    return NextResponse.json(output);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Create tasks] Error:", msg);
    return NextResponse.json(
      { error: msg || "Internal server error" },
      { status: 500 }
    );
  }
}
