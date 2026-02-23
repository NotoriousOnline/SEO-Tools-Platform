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

function getPriorityEnumGid(priority: string): string | null {
  switch (priority.toLowerCase()) {
    case "high":
      return process.env.ASANA_PRIORITY_HIGH_GID || null;
    case "medium":
      return process.env.ASANA_PRIORITY_MEDIUM_GID || null;
    case "low":
      return process.env.ASANA_PRIORITY_LOW_GID || null;
    default:
      return process.env.ASANA_PRIORITY_MEDIUM_GID || null;
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

    const token = process.env.ASANA_ACCESS_TOKEN;
    const projectGid = process.env.ASANA_PROJECT_GID;

    if (!token || !projectGid) {
      return NextResponse.json(
        { error: "Missing ASANA_ACCESS_TOKEN or ASANA_PROJECT_GID" },
        { status: 500 }
      );
    }

    const meetingContext = `\n\nMeeting: ${meeting_title} (${date})`;

    const priorityFieldGid = process.env.ASANA_PRIORITY_FIELD_GID;
    if (!priorityFieldGid) {
      console.warn(
        "[Create tasks] ASANA_PRIORITY_FIELD_GID not set — priority will not be applied"
      );
    }

    const createTask = async (
      action: ActionItem
    ): Promise<
      | { success: true; task_gid: string; task_url: string; task_title: string }
      | { success: false; error: string; task_title: string }
    > => {
      const task_title = String(action.task_title ?? "Untitled task");
      const description = String(action.description ?? "");
      const due_date = formatDueDate(action.due_date);

      const priorityEnumGid = getPriorityEnumGid(
        action.priority ?? "Medium"
      );
      const customFields =
        priorityFieldGid && priorityEnumGid
          ? { [priorityFieldGid]: priorityEnumGid }
          : {};

      const data: Record<string, unknown> = {
        name: task_title,
        notes: description + meetingContext,
        projects: [projectGid],
        custom_fields: customFields,
      };

      if (due_date) {
        data.due_on = due_date;
      }

      try {
        const res = await fetch("https://app.asana.com/api/1.0/tasks", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ data }),
        });

        if (!res.ok) {
          const errText = await res.text();
          return {
            success: false,
            error: errText || `HTTP ${res.status}`,
            task_title,
          };
        }

        const json = (await res.json()) as { data?: { gid?: string } };
        const task_gid = json.data?.gid ?? "";
        const task_url = task_gid
          ? `https://app.asana.com/0/0/${task_gid}`
          : "";

        return {
          success: true,
          task_gid,
          task_url,
          task_title,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          error: msg,
          task_title,
        };
      }
    };

    const results = await Promise.allSettled(actions.map(createTask));

    const output = results.map((r) => {
      if (r.status === "fulfilled") return r.value;
      return {
        success: false as const,
        error: r.reason?.message ?? String(r.reason),
        task_title: "Unknown",
      };
    });

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
