/**
 * Shared in-memory store for the latest meeting payload.
 * Used by webhook, manual input, and status API.
 */
export type MeetingPayload = {
  meeting_title: string;
  date: string;
  participants: string[];
  summary: string;
  action_items: string[];
  transcript: string;
  source?: "manual" | "webhook";
};

let latestMeeting: MeetingPayload | null = null;

export function getLatestMeeting(): MeetingPayload | null {
  return latestMeeting;
}

export function setLatestMeeting(data: MeetingPayload | null): void {
  latestMeeting = data;
}
