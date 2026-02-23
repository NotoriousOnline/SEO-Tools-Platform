"use client";

import { useState, useEffect, useCallback } from "react";
import { MeetingToActionsUI } from "./MeetingToActionsUI";
import type { MeetingPayload, ActionItem, EmailDraft, TaskResult } from "./types";

function formatEmailBody(draft: EmailDraft): string {
  const parts: string[] = [];
  if (draft.greeting) parts.push(draft.greeting, "");
  if (draft.summary_bullets?.length) parts.push(...draft.summary_bullets.map((b) => `• ${b}`), "");
  if (draft.decisions?.length) parts.push("Decisions:", ...draft.decisions.map((d) => `• ${d}`), "");
  if (draft.next_steps?.length) parts.push("Next steps:", ...draft.next_steps.map((n) => `• ${n}`), "");
  if (draft.closing) parts.push(draft.closing);
  return parts.join("\n");
}

type Tab = "webhook" | "manual";

export default function MeetingToActionsTool() {
  const [activeTab, setActiveTab] = useState<Tab>("webhook");
  const [meeting, setMeeting] = useState<MeetingPayload | null>(null);
  const [processLoading, setProcessLoading] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);
  const [manualTitle, setManualTitle] = useState("");
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [manualParticipants, setManualParticipants] = useState("");
  const [manualSummary, setManualSummary] = useState("");
  const [manualTranscript, setManualTranscript] = useState("");
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [emailDraft, setEmailDraft] = useState<EmailDraft | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [asanaLoading, setAsanaLoading] = useState(false);
  const [taskResults, setTaskResults] = useState<TaskResult[] | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [gmailLink, setGmailLink] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [slackLoading, setSlackLoading] = useState(false);
  const [slackSuccess, setSlackSuccess] = useState(false);
  const [slackError, setSlackError] = useState<string | null>(null);
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/meeting-to-actions/status");
      const data = (await res.json()) as { meeting: MeetingPayload | null };
      if (data.meeting) setMeeting(data.meeting);
    } catch {}
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 10000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  const handleProcess = async () => {
    if (!meeting) return;
    setProcessLoading(true);
    setProcessError(null);
    try {
      const res = await fetch("/api/meeting-to-actions/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meeting_title: meeting.meeting_title, date: meeting.date, participants: meeting.participants, summary: meeting.summary, transcript: meeting.transcript, extraction_mode: "explicit_and_implicit" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProcessError(data.error ?? "Process failed");
        return;
      }
      const parsed = data as { email_draft?: EmailDraft; actions?: ActionItem[] };
      if (parsed.actions?.length) {
        setActions(parsed.actions.map((a) => ({ task_title: a.task_title ?? "", description: a.description ?? "", owner: a.owner ?? "Unassigned", due_date: a.due_date ?? "", priority: (a.priority as "High" | "Medium" | "Low") ?? "Medium", related_to_client: a.related_to_client })));
      }
      if (parsed.email_draft) {
        setEmailDraft(parsed.email_draft);
        setEmailSubject(parsed.email_draft.subject ?? "");
        setEmailBody(formatEmailBody(parsed.email_draft));
      }
    } catch (err) {
      setProcessError(err instanceof Error ? err.message : "Process failed");
    } finally {
      setProcessLoading(false);
    }
  };

  const handleLoadAndProcess = async () => {
    setProcessError(null);
    if (!manualTitle.trim()) { setProcessError("Meeting title is required"); return; }
    if (!manualDate.trim()) { setProcessError("Date is required"); return; }
    setProcessLoading(true);
    try {
      const res = await fetch("/api/meeting-to-actions/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meeting_title: manualTitle, date: manualDate, participants: manualParticipants, summary: manualSummary, transcript: manualTranscript }),
      });
      const data = (await res.json()) as { success?: boolean; meeting?: MeetingPayload; error?: string };
      if (!res.ok || !data.success) {
        setProcessError(data.error ?? "Failed to load meeting");
        return;
      }
      const loadedMeeting = data.meeting;
      if (!loadedMeeting) { setProcessError("No meeting returned"); return; }
      setMeeting(loadedMeeting);

      const processRes = await fetch("/api/meeting-to-actions/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meeting_title: loadedMeeting.meeting_title, date: loadedMeeting.date, participants: loadedMeeting.participants, summary: loadedMeeting.summary, transcript: loadedMeeting.transcript, extraction_mode: "explicit_and_implicit" }),
      });
      const processData = (await processRes.json()) as { email_draft?: EmailDraft; actions?: ActionItem[]; error?: string };
      if (!processRes.ok) {
        setProcessError(processData.error ?? "Process failed");
        return;
      }
      if (processData.actions?.length) {
        setActions(processData.actions.map((a) => ({ task_title: a.task_title ?? "", description: a.description ?? "", owner: a.owner ?? "Unassigned", due_date: a.due_date ?? "", priority: (a.priority as "High" | "Medium" | "Low") ?? "Medium", related_to_client: a.related_to_client })));
      }
      if (processData.email_draft) {
        setEmailDraft(processData.email_draft);
        setEmailSubject(processData.email_draft.subject ?? "");
        setEmailBody(formatEmailBody(processData.email_draft));
      }
    } catch (err) {
      setProcessError(err instanceof Error ? err.message : "Load & process failed");
    } finally {
      setProcessLoading(false);
    }
  };

  const handlePushAsana = async () => {
    if (!meeting) return;
    setAsanaLoading(true);
    setTaskResults(null);
    try {
      const res = await fetch("/api/meeting-to-actions/create-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meeting_title: meeting.meeting_title, date: meeting.date, actions: actions.map((a) => ({ task_title: a.task_title, description: a.description, owner: a.owner, due_date: a.due_date || undefined, priority: a.priority })) }),
      });
      const data = (await res.json()) as TaskResult[];
      setTaskResults(Array.isArray(data) ? data : []);
    } catch (err) {
      setTaskResults([{ success: false, error: err instanceof Error ? err.message : "Failed to create tasks", task_title: "Request failed" }]);
    } finally {
      setAsanaLoading(false);
    }
  };

  const handleCreateDraft = async () => {
    setDraftLoading(true);
    setDraftError(null);
    setGmailLink(null);
    try {
      const res = await fetch("/api/meeting-to-actions/create-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: emailSubject, body: emailBody }),
      });
      const data = (await res.json()) as { draft_id?: string; gmail_link?: string; error?: string };
      if (!res.ok) {
        setDraftError(data.error ?? "Failed to create draft");
        return;
      }
      setGmailLink(data.gmail_link ?? null);
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : "Failed to create draft");
    } finally {
      setDraftLoading(false);
    }
  };

  const handleNotifySlack = async () => {
    if (!meeting || !taskResults || !gmailLink) return;
    setSlackLoading(true);
    setSlackSuccess(false);
    setSlackError(null);
    try {
      const tasks = taskResults
        .map((r, i) => (r.success ? { task_title: r.task_title, owner: actions[i]?.owner ?? "—", task_url: r.task_url } : null))
        .filter((t) => t !== null);
      const res = await fetch("/api/meeting-to-actions/notify-slack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meeting_title: meeting.meeting_title, date: meeting.date, tasks, gmail_link: gmailLink }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (data.success) setSlackSuccess(true);
      else setSlackError(data.error ?? "Slack notification failed");
    } catch (err) {
      setSlackError(err instanceof Error ? err.message : "Slack notification failed");
    } finally {
      setSlackLoading(false);
    }
  };

  const updateAction = (i: number, updates: Partial<ActionItem>) => {
    setActions((prev) => prev.map((a, j) => (j === i ? { ...a, ...updates } : a)));
  };

  const removeAction = (i: number) => {
    setActions((prev) => prev.filter((_, j) => j !== i));
  };

  const processComplete = actions.length > 0 || emailDraft !== null;
  const asanaComplete = taskResults !== null && taskResults.every((r) => r.success);
  const draftComplete = gmailLink !== null;
  const slackActive = asanaComplete && draftComplete;

  return (
    <MeetingToActionsUI
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      meeting={meeting}
      processLoading={processLoading}
      processError={processError}
      manualTitle={manualTitle}
      setManualTitle={setManualTitle}
      manualDate={manualDate}
      setManualDate={setManualDate}
      manualParticipants={manualParticipants}
      setManualParticipants={setManualParticipants}
      manualSummary={manualSummary}
      setManualSummary={setManualSummary}
      manualTranscript={manualTranscript}
      setManualTranscript={setManualTranscript}
      actions={actions}
      updateAction={updateAction}
      removeAction={removeAction}
      taskResults={taskResults}
      asanaLoading={asanaLoading}
      emailSubject={emailSubject}
      setEmailSubject={setEmailSubject}
      emailBody={emailBody}
      setEmailBody={setEmailBody}
      draftLoading={draftLoading}
      gmailLink={gmailLink}
      draftError={draftError}
      emailDraft={emailDraft}
      slackLoading={slackLoading}
      slackSuccess={slackSuccess}
      slackError={slackError}
      processComplete={processComplete}
      slackActive={slackActive}
      onProcess={handleProcess}
      onLoadAndProcess={handleLoadAndProcess}
      onPushAsana={handlePushAsana}
      onCreateDraft={handleCreateDraft}
      onNotifySlack={handleNotifySlack}
    />
  );
}
