/**
 * Shared in-memory store for meeting payloads.
 * Keeps latest + history of past meetings (webhook + manual).
 */
export type MeetingPayload = {
  id?: string;
  meeting_title: string;
  date: string;
  participants: string[];
  summary: string;
  action_items: string[];
  transcript: string;
  meeting_urls?: string[];
  source?: "manual" | "webhook";
};

const MAX_MEETINGS_HISTORY = 50;

let latestMeeting: MeetingPayload | null = null;
let meetingsHistory: MeetingPayload[] = [];

function ensureId(m: MeetingPayload): MeetingPayload {
  if (m.id) return m;
  return { ...m, id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` };
}

export function getLatestMeeting(): MeetingPayload | null {
  return latestMeeting;
}

export function getAllMeetings(): MeetingPayload[] {
  return [...meetingsHistory];
}

export function getMeetingById(id: string): MeetingPayload | null {
  return meetingsHistory.find((m) => m.id === id) ?? null;
}

export function setLatestMeeting(data: MeetingPayload | null): void {
  latestMeeting = data;
  if (data) {
    const withId = ensureId(data);
    latestMeeting = withId;
    meetingsHistory = [withId, ...meetingsHistory.filter((m) => m.id !== withId.id)].slice(0, MAX_MEETINGS_HISTORY);
  }
}
