export type MeetingPayload = {
  meeting_title: string;
  date: string;
  participants: string[];
  summary: string;
  action_items: string[];
  transcript: string;
};

export type ActionItem = {
  task_title: string;
  description: string;
  owner: string;
  due_date: string;
  priority: "High" | "Medium" | "Low";
  related_to_client?: boolean;
};

export type EmailDraft = {
  subject?: string;
  greeting?: string;
  summary_bullets?: string[];
  decisions?: string[];
  next_steps?: string[];
  closing?: string;
};

export type TaskResult =
  | { success: true; task_gid: string; task_url: string; task_title: string }
  | { success: false; error: string; task_title: string };
