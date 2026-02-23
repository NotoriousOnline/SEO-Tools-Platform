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

function prefixWithPriority(title: string, priority?: string): string {
  const p = (priority ?? "").toLowerCase();
  if (p === "high") return `[HIGH] ${title}`;
  if (p === "medium") return `[MEDIUM] ${title}`;
  if (p === "low") return `[LOW] ${title}`;
  return title;
}

function getPriorityEnumGid(priority?: string): string | undefined {
  const p = (priority ?? "").toLowerCase();
  if (p === "high") return process.env.ASANA_PRIORITY_HIGH_GID;
  if (p === "medium") return process.env.ASANA_PRIORITY_MEDIUM_GID;
  if (p === "low") return process.env.ASANA_PRIORITY_LOW_GID;
  return undefined;
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

    const createTask = async (
      action: ActionItem
    ): Promise<
      | { success: true; task_gid: string; task_url: string; task_title: string }
      | { success: false; error: string; task_title: string }
    > => {
      const task_title = String(action.task_title ?? "Untitled task");
      const description = String(action.description ?? "");
      const due_date = formatDueDate(action.due_date);
      const nameWithPriority = prefixWithPriority(task_title, action.priority);

      const data: Record<string, unknown> = {
        name: nameWithPriority,
        notes: description + meetingContext,
        projects: [projectGid],
      };

      if (due_date) {
        data.due_on = due_date;
      }

      const priorityFieldGid = process.env.ASANA_PRIORITY_FIELD_GID;
      const priorityEnumGid = getPriorityEnumGid(action.priority);
      if (priorityFieldGid && priorityEnumGid) {
        data.custom_fields = { [priorityFieldGid]: priorityEnumGid };
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
            task_title: nameWithPriority,
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
          task_title: nameWithPriority,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          error: msg,
          task_title: nameWithPriority,
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
