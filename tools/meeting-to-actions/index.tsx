"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { PasswordGate } from "@/components/PasswordGate";
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
  const [projectGid, setProjectGid] = useState<string | null>(null);
  const [projectUrl, setProjectUrl] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [priorityGids, setPriorityGids] = useState<{
    priority_field_gid: string;
    priority_high_gid: string;
    priority_medium_gid: string;
    priority_low_gid: string;
  } | null>(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [asanaLoading, setAsanaLoading] = useState(false);
  const [taskResults, setTaskResults] = useState<TaskResult[] | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [gmailLink, setGmailLink] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [slackLoading, setSlackLoading] = useState(false);
  const [slackSuccess, setSlackSuccess] = useState(false);
  const [slackError, setSlackError] = useState<string | null>(null);
  const [meetings, setMeetings] = useState<MeetingPayload[]>([]);
  const [fathomMeetings, setFathomMeetings] = useState<MeetingPayload[]>([]);
  const [fathomLoading, setFathomLoading] = useState(false);
  const [meetingFromWebhook, setMeetingFromWebhook] = useState<MeetingPayload | null>(null);
  const [meetingSource, setMeetingSource] = useState<"webhook" | "past">("webhook");
  const meetingSourceRef = useRef(meetingSource);
  meetingSourceRef.current = meetingSource;
  const processAbortRef = useRef<AbortController | null>(null);
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/meeting-to-actions/status");
      const data = (await res.json()) as { meeting: MeetingPayload | null; meetings?: MeetingPayload[] };
      setMeetingFromWebhook(data.meeting ?? null);
      if (data.meetings) setMeetings(data.meetings);
      if (meetingSourceRef.current !== "past") setMeeting(data.meeting ?? null);
    } catch {}
  }, []);

  const handleLoadFathomMeetings = useCallback(async () => {
    setFathomLoading(true);
    try {
      const res = await fetch("/api/meeting-to-actions/fathom-meetings?limit=20");
      const data = (await res.json()) as { meetings?: MeetingPayload[]; error?: string };
      if (data.meetings) setFathomMeetings(data.meetings);
      else if (data.error) setProcessError(data.error);
    } catch (err) {
      setProcessError(err instanceof Error ? err.message : "Failed to load Fathom meetings");
    } finally {
      setFathomLoading(false);
    }
  }, []);

  const handleSelectMeeting = useCallback((m: MeetingPayload) => {
    setMeeting(m);
    setMeetingSource("past");
  }, []);

  const handleCreateProject = useCallback(async (m: MeetingPayload) => {
    setProjectLoading(true);
    setProjectError(null);
    setProjectGid(null);
    setProjectUrl(null);
    setProjectName(null);
    setPriorityGids(null);
    try {
      const res = await fetch("/api/meeting-to-actions/create-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meeting_title: m.meeting_title, date: m.date }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        project_gid?: string;
        project_url?: string;
        project_name?: string;
        priority_field_gid?: string;
        priority_high_gid?: string;
        priority_medium_gid?: string;
        priority_low_gid?: string;
        error?: string;
      };
      if (data.success && data.project_gid) {
        setProjectGid(data.project_gid);
        setProjectUrl(data.project_url ?? null);
        setProjectName(data.project_name ?? m.meeting_title);
        if (data.priority_field_gid && data.priority_high_gid && data.priority_medium_gid && data.priority_low_gid) {
          setPriorityGids({
            priority_field_gid: data.priority_field_gid,
            priority_high_gid: data.priority_high_gid,
            priority_medium_gid: data.priority_medium_gid,
            priority_low_gid: data.priority_low_gid,
          });
        }
      } else {
        setProjectError(data.error ?? "Project creation failed");
      }
    } catch (err) {
      setProjectError(err instanceof Error ? err.message : "Project creation failed");
    } finally {
      setProjectLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 3600000); // 1 hour
    return () => clearInterval(id);
  }, [fetchStatus]);

  useEffect(() => {
    handleLoadFathomMeetings();
    const id = setInterval(handleLoadFathomMeetings, 30000);
    return () => clearInterval(id);
  }, [handleLoadFathomMeetings]);

  const processMeeting = useCallback(async (m: MeetingPayload) => {
    setProcessLoading(true);
    setProcessError(null);
    setProjectGid(null);
    setProjectUrl(null);
    setProjectName(null);
    setProjectError(null);
    setPriorityGids(null);
    const controller = new AbortController();
    processAbortRef.current = controller;
    try {
      const res = await fetch("/api/meeting-to-actions/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meeting_title: m.meeting_title, date: m.date, participants: m.participants, summary: m.summary, transcript: m.transcript, extraction_mode: "explicit_and_implicit" }),
        signal: controller.signal,
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
      await handleCreateProject(m);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setProcessError("Cancelled");
      } else {
        setProcessError(err instanceof Error ? err.message : "Process failed");
      }
    } finally {
      processAbortRef.current = null;
      setProcessLoading(false);
    }
  }, [handleCreateProject]);

  const handleProcess = async () => {
    if (!meeting) return;
    await processMeeting(meeting);
  };

  const handleCancelProcess = useCallback(() => {
    processAbortRef.current?.abort();
  }, []);

  const handleLoadAndProcess = async () => {
    setProcessError(null);
    if (!manualTitle.trim()) { setProcessError("Meeting title is required"); return; }
    if (!manualDate.trim()) { setProcessError("Date is required"); return; }
    setProcessLoading(true);
    setProjectGid(null);
    setProjectUrl(null);
    setProjectName(null);
    setProjectError(null);
    setPriorityGids(null);
    const controller = new AbortController();
    processAbortRef.current = controller;
    try {
      const res = await fetch("/api/meeting-to-actions/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meeting_title: manualTitle, date: manualDate, participants: manualParticipants, summary: manualSummary, transcript: manualTranscript }),
        signal: controller.signal,
      });
      const data = (await res.json()) as { success?: boolean; meeting?: MeetingPayload; error?: string };
      if (!res.ok || !data.success) {
        setProcessError(data.error ?? "Failed to load meeting");
        return;
      }
      const loadedMeeting = data.meeting;
      if (!loadedMeeting) { setProcessError("No meeting returned"); return; }
      setMeeting(loadedMeeting);
      setMeetingSource("webhook");
      setMeetingFromWebhook(loadedMeeting);

      const processRes = await fetch("/api/meeting-to-actions/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meeting_title: loadedMeeting.meeting_title, date: loadedMeeting.date, participants: loadedMeeting.participants, summary: loadedMeeting.summary, transcript: loadedMeeting.transcript, extraction_mode: "explicit_and_implicit" }),
        signal: controller.signal,
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
      await handleCreateProject(loadedMeeting);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setProcessError("Cancelled");
      } else {
        setProcessError(err instanceof Error ? err.message : "Load & process failed");
      }
    } finally {
      processAbortRef.current = null;
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
        body: JSON.stringify({
          meeting_title: meeting.meeting_title,
          date: meeting.date,
          actions: actions.map((a) => ({
            task_title: a.task_title,
            description: a.description,
            owner: a.owner,
            due_date: a.due_date || undefined,
            priority: (a.priority as "High" | "Medium" | "Low") ?? "Medium",
          })),
          ...(projectGid ? { project_gid: projectGid } : {}),
          ...(priorityGids ? priorityGids : {}),
        }),
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
        body: JSON.stringify({ meeting_title: meeting.meeting_title, date: meeting.date, tasks, gmail_link: gmailLink, project_url: projectUrl ?? undefined }),
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

  const allPastMeetings = [
    ...meetings,
    ...fathomMeetings.filter((f) => !meetings.some((m) => m.id === f.id)),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <PasswordGate toolName="Meeting to Actions">
      <MeetingToActionsUI
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      incomingMeeting={meetingFromWebhook}
      selectedMeeting={meetingSource === "past" ? meeting : null}
      meetingSource={meetingSource}
      meeting={meeting}
      meetings={allPastMeetings}
      fathomLoading={fathomLoading}
      onSelectMeeting={handleSelectMeeting}
      onClearSelection={() => { setMeeting(meetingFromWebhook); setMeetingSource("webhook"); }}
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
      projectGid={projectGid}
      projectUrl={projectUrl}
      projectName={projectName}
      projectLoading={projectLoading}
      projectError={projectError}
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
      onCancelProcess={handleCancelProcess}
      onLoadAndProcess={handleLoadAndProcess}
      onPushAsana={handlePushAsana}
      onCreateDraft={handleCreateDraft}
      onNotifySlack={handleNotifySlack}
    />
    </PasswordGate>
  );
}
