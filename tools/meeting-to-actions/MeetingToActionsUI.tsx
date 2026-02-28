"use client";

import { useState } from "react";
import type { MeetingPayload, ActionItem, TaskResult } from "./types";

type Tab = "webhook" | "manual";

type Props = {
  activeTab: Tab;
  setActiveTab: (t: Tab) => void;
  incomingMeeting: MeetingPayload | null;
  selectedMeeting: MeetingPayload | null;
  meetingSource: "webhook" | "past";
  meeting: MeetingPayload | null;
  meetings: MeetingPayload[];
  fathomLoading: boolean;
  onSelectMeeting: (m: MeetingPayload) => void;
  onClearSelection?: () => void;
  processLoading: boolean;
  processError: string | null;
  manualTitle: string;
  setManualTitle: (s: string) => void;
  manualDate: string;
  setManualDate: (s: string) => void;
  manualParticipants: string;
  setManualParticipants: (s: string) => void;
  manualSummary: string;
  setManualSummary: (s: string) => void;
  manualTranscript: string;
  setManualTranscript: (s: string) => void;
  actions: ActionItem[];
  updateAction: (i: number, u: Partial<ActionItem>) => void;
  removeAction: (i: number) => void;
  taskResults: TaskResult[] | null;
  asanaLoading: boolean;
  projectGid: string | null;
  projectUrl: string | null;
  projectName: string | null;
  projectLoading: boolean;
  projectError: string | null;
  emailSubject: string;
  setEmailSubject: (s: string) => void;
  emailBody: string;
  setEmailBody: (s: string) => void;
  draftLoading: boolean;
  gmailLink: string | null;
  draftError: string | null;
  emailDraft: { subject?: string } | null;
  slackLoading: boolean;
  slackSuccess: boolean;
  slackError: string | null;
  processComplete: boolean;
  slackActive: boolean;
  onProcess: () => void;
  onCancelProcess: () => void;
  onLoadAndProcess: () => void;
  onPushAsana: () => void;
  onCreateDraft: () => void;
  onNotifySlack: () => void;
};

export function MeetingToActionsUI(props: Props) {
  const {
    activeTab,
    setActiveTab,
    incomingMeeting,
    selectedMeeting,
    meetingSource,
    meeting,
    meetings,
    fathomLoading,
    onSelectMeeting,
    onClearSelection,
    processLoading,
    processError,
    manualTitle,
    setManualTitle,
    manualDate,
    setManualDate,
    manualParticipants,
    setManualParticipants,
    manualSummary,
    setManualSummary,
    manualTranscript,
    setManualTranscript,
    actions,
    updateAction,
    removeAction,
    taskResults,
    asanaLoading,
    projectGid,
    projectUrl,
    projectName,
    projectLoading,
    projectError,
    emailSubject,
    setEmailSubject,
    emailBody,
    setEmailBody,
    draftLoading,
    gmailLink,
    draftError,
    emailDraft,
    slackLoading,
    slackSuccess,
    slackError,
    processComplete,
    slackActive,
    onProcess,
    onCancelProcess,
    onLoadAndProcess,
    onPushAsana,
    onCreateDraft,
    onNotifySlack,
  } = props;

  const [pastMeetingsOpen, setPastMeetingsOpen] = useState(false);
  const sectionCls = "rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:p-6";
  const disabledCls = " opacity-50 pointer-events-none";
  const inputCls = "w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 placeholder-slate-400 transition-colors focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-200 sm:text-sm";
  const btnPrimary = "min-h-[44px] w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-teal-700 hover:shadow-lg disabled:opacity-50 sm:w-auto sm:py-2.5";
  const btnSuccess = "min-h-[44px] w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-emerald-700 hover:shadow-lg disabled:opacity-50 sm:w-auto sm:py-2.5";
  const btnSlack = "min-h-[44px] w-full rounded-xl bg-violet-700 px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-violet-800 hover:shadow-lg disabled:opacity-50 sm:w-auto sm:py-2.5";
  const asanaAllPushed = taskResults !== null && taskResults.length === actions.length && taskResults.every((r) => r.success);

  return (
    <div className="space-y-4 sm:space-y-6">
        <section className={sectionCls}>
          <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-base font-semibold text-slate-800 sm:text-lg">Incoming Meeting</h3>
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setActiveTab("webhook")}
                className={activeTab === "webhook" ? "rounded-lg bg-white px-4 py-2 text-sm font-medium text-indigo-700 shadow-sm" : "rounded-lg px-4 py-2 text-sm text-slate-600 hover:text-slate-900"}
              >
                Auto (Fathom Webhook)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("manual")}
                className={activeTab === "manual" ? "rounded-lg bg-white px-4 py-2 text-sm font-medium text-indigo-700 shadow-sm" : "rounded-lg px-4 py-2 text-sm text-slate-600 hover:text-slate-900"}
              >
                Manual Entry
              </button>
            </div>
          </div>

          {activeTab === "webhook" ? (
            !incomingMeeting ? (
              <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-5">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-500" />
                <p className="text-sm font-medium text-amber-800">Waiting for Fathom webhook… Polling every 1 hour.</p>
              </div>
            ) : (
              <div>
                <div className="space-y-2 rounded-xl bg-slate-50 p-5 text-sm">
                  <p><span className="font-semibold text-slate-600">Title:</span> <span className="text-slate-800">{incomingMeeting.meeting_title}</span></p>
                  <p><span className="font-semibold text-slate-600">Date:</span> <span className="text-slate-800">{incomingMeeting.date}</span></p>
                  {incomingMeeting.meeting_urls && incomingMeeting.meeting_urls.length > 0 && (
                    <div>
                      <span className="font-semibold text-slate-600">Meeting URLs:</span>
                      <ul className="mt-1 list-inside list-disc space-y-0.5">
                        {incomingMeeting.meeting_urls.map((url, i) => (
                          <li key={i} className="break-all">
                            <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-teal-600 hover:text-teal-700 hover:underline">
                              {url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p><span className="font-semibold text-slate-600">Participants:</span> <span className="text-slate-800">{incomingMeeting.participants.length > 0 ? incomingMeeting.participants.join(", ") : "—"}</span></p>
                </div>
                {meetingSource === "webhook" && (
                  <>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button onClick={onProcess} disabled={processLoading} className="min-h-[44px] w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-teal-700 hover:shadow-lg disabled:opacity-50 sm:w-auto sm:py-2.5">
                        {processLoading ? "Processing…" : "Process with Claude"}
                      </button>
                      {processLoading && (
                        <button onClick={onCancelProcess} className="min-h-[44px] rounded-xl border-2 border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition-all hover:border-slate-400 hover:bg-slate-50">
                          Cancel
                        </button>
                      )}
                    </div>
                    {processError && <p className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">{processError}</p>}
                  </>
                )}
              </div>
            )
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">Paste meeting details from your Fathom link, then click Load & Process.</p>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Meeting Title (required)</label>
                <input type="text" value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} placeholder="e.g. Q1 Planning - Acme Corp" className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Date (required)</label>
                <input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Participants (comma-separated)</label>
                <input type="text" value={manualParticipants} onChange={(e) => setManualParticipants(e.target.value)} placeholder="e.g. Sam, Alex, Client Name" className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Summary</label>
                <textarea value={manualSummary} onChange={(e) => setManualSummary(e.target.value)} placeholder="Paste the meeting summary from Fathom" rows={4} className={`${inputCls} resize-none`} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Transcript (optional)</label>
                <textarea value={manualTranscript} onChange={(e) => setManualTranscript(e.target.value)} placeholder="Paste the full transcript from Fathom" rows={8} className={`${inputCls} resize-none`} />
              </div>
              <button onClick={onLoadAndProcess} disabled={processLoading} className={btnPrimary}>
              {processLoading ? "Loading…" : "Load & Process with Claude"}
            </button>
              {processError && <p className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">{processError}</p>}
            </div>
          )}
        </section>

        <section className={sectionCls}>
          <button type="button" onClick={() => setPastMeetingsOpen(!pastMeetingsOpen)} className="-mx-2 mb-4 flex w-full items-center justify-between rounded-xl px-2 py-2 transition-colors hover:bg-slate-50">
            <h3 className="text-lg font-semibold text-slate-800">Past Meetings</h3>
            <div className="flex items-center gap-2">
              {fathomLoading && <span className="text-xs text-slate-500">Loading…</span>}
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`h-5 w-5 text-slate-500 transition-transform ${pastMeetingsOpen ? "rotate-180" : ""}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
          </button>
          {pastMeetingsOpen && (
          <>
          {selectedMeeting && (
            <div className="mb-5 rounded-xl border border-indigo-200 bg-indigo-50/50 p-5">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-teal-600">Selected for processing</p>
                {onClearSelection && (
                  <button type="button" onClick={onClearSelection} className="text-xs text-slate-500 hover:text-slate-700">
                    Clear
                  </button>
                )}
              </div>
              <div className="space-y-2 text-sm">
                <p><span className="font-semibold text-slate-600">Title:</span> <span className="text-slate-800">{selectedMeeting.meeting_title}</span></p>
                <p><span className="font-semibold text-slate-600">Date:</span> <span className="text-slate-800">{selectedMeeting.date}</span></p>
                {selectedMeeting.meeting_urls && selectedMeeting.meeting_urls.length > 0 && (
                  <div>
                    <span className="font-semibold text-slate-600">Meeting URLs:</span>
                    <ul className="mt-1 list-inside list-disc space-y-0.5">
                        {selectedMeeting.meeting_urls.map((url, i) => (
                        <li key={i} className="break-all">
                          <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-teal-600 hover:text-teal-700 hover:underline">
                            {url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p><span className="font-semibold text-slate-600">Participants:</span> <span className="text-slate-800">{selectedMeeting.participants.length > 0 ? selectedMeeting.participants.join(", ") : "—"}</span></p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={onProcess} disabled={processLoading} className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-teal-700 hover:shadow-lg disabled:opacity-50">
                  {processLoading ? "Processing…" : "Process with Claude"}
                </button>
                {processLoading && (
                  <button onClick={onCancelProcess} className="rounded-xl border-2 border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition-all hover:border-slate-400 hover:bg-slate-50">
                    Cancel
                  </button>
                )}
              </div>
              {processError && <p className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">{processError}</p>}
            </div>
          )}
          {meetings.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-10 text-center">
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
              </div>
              <p className="text-sm text-slate-500">No past meetings yet</p>
              <p className="mt-0.5 text-xs text-slate-400">Use webhook or wait for meetings to load</p>
            </div>
          ) : (
            <ul className="max-h-52 space-y-2 overflow-y-auto pr-1">
              {meetings.map((m) => (
                <li key={m.id ?? m.meeting_title + m.date}>
                  <button type="button" onClick={() => onSelectMeeting(m)} className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left shadow-sm transition-all hover:border-teal-200 hover:bg-white hover:shadow-md">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-600 group-hover:bg-teal-200">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-800 group-hover:text-indigo-700">{m.meeting_title}</p>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                        <span>{new Date(m.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                        {m.meeting_urls && m.meeting_urls.length > 0 && (
                          <span className="flex items-center gap-0.5 rounded-full bg-teal-50 px-1.5 py-0.5 text-teal-600">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-3 w-3">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                            </svg>
                            {m.meeting_urls.length}
                          </span>
                        )}
                      </div>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-indigo-700 group-hover:translate-x-0.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
          </>
          )}
        </section>

        <section className={sectionCls + (!processComplete ? disabledCls : "")}>
          <h3 className="mb-5 text-lg font-semibold text-slate-800">Review & Edit Tasks</h3>
          {actions.length === 0 && processComplete ? (
            <p className="text-sm text-slate-500">No actions extracted.</p>
          ) : (
            <div className="space-y-4">
              {actions.map((action, i) => (
                <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                  <div className="mb-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Task title</label>
                      <input type="text" value={action.task_title} onChange={(e) => updateAction(i, { task_title: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Owner</label>
                      <input type="text" value={action.owner} onChange={(e) => updateAction(i, { owner: e.target.value })} className={inputCls} />
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Description</label>
                    <textarea value={action.description} onChange={(e) => updateAction(i, { description: e.target.value })} rows={2} className={`${inputCls} resize-none`} />
                  </div>
                  <div className="flex flex-wrap items-end gap-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Due date</label>
                      <input type="date" value={action.due_date} onChange={(e) => updateAction(i, { due_date: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Priority</label>
                      <div className="flex gap-1.5">
                        {["High", "Medium", "Low"].map((p) => (
                          <button key={p} type="button" onClick={() => updateAction(i, { priority: p as "High" | "Medium" | "Low" })} className={action.priority === p ? "rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm" : "rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-300"}>
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button type="button" onClick={() => removeAction(i)} className="ml-auto rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">Remove</button>
                  </div>
                  {taskResults?.[i] && (
                    <div className="mt-3 text-sm">
                      {taskResults[i].success ? (
                        <a href={(taskResults[i] as { task_url: string }).task_url} target="_blank" rel="noopener noreferrer" className="font-medium text-emerald-600 hover:text-emerald-700 hover:underline">Open in Asana →</a>
                      ) : (
                        <p className="text-red-600">{(taskResults[i] as { error: string }).error}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {actions.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  {projectLoading && (
                    <p className="flex items-center gap-2 text-sm text-slate-600">
                      <svg className="h-4 w-4 animate-spin text-teal-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden>
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Creating Asana project…
                    </p>
                  )}
                  {!projectLoading && projectUrl && projectName && (
                    <p className="text-sm text-emerald-700">
                      <span className="mr-1">Project created:</span>
                      <a href={projectUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-emerald-600 hover:text-emerald-800 hover:underline">
                        {projectName}
                      </a>
                    </p>
                  )}
                  {!projectLoading && projectError && (
                    <p className="text-sm text-amber-600">Project creation failed — tasks will use default project.</p>
                  )}
                </div>
              )}
              <button
                onClick={onPushAsana}
                disabled={asanaLoading || actions.length === 0 || asanaAllPushed}
                className={btnSuccess}
                title={asanaAllPushed ? "Tasks are already pushed" : undefined}
              >
                {asanaLoading ? "Pushing…" : asanaAllPushed ? "Tasks are already pushed" : "Push All to Asana"}
              </button>
            </div>
          )}
        </section>

        <section className={sectionCls + (!processComplete ? disabledCls : "")}>
          <h3 className="mb-5 text-lg font-semibold text-slate-800">Review & Edit Email Draft</h3>
          {emailDraft !== null && (
            <div>
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</label>
                <input type="text" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} className={inputCls} />
              </div>
              <div className="mb-5">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Email body</label>
                <textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows={8} className={`${inputCls} resize-none`} />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button onClick={onCreateDraft} disabled={draftLoading} className={btnPrimary}>
                  {draftLoading ? "Creating…" : "Create Gmail Draft"}
                </button>
                {gmailLink && <a href={gmailLink} target="_blank" rel="noopener noreferrer" className="rounded-xl border-2 border-teal-200 px-4 py-2.5 text-sm font-semibold text-teal-600 transition-colors hover:border-teal-300 hover:bg-teal-50">Open in Gmail</a>}
              </div>
              {draftError && <p className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">{draftError}</p>}
            </div>
          )}
          {processComplete && !emailDraft && <p className="text-sm text-slate-500">No email draft from Claude.</p>}
        </section>

        <section className={sectionCls + (!slackActive ? disabledCls : "")}>
          <h3 className="mb-4 text-lg font-semibold text-slate-800">Notify Team</h3>
          <p className="mb-5 text-sm text-slate-600">Complete Asana and Gmail steps above to enable.</p>
          <button onClick={onNotifySlack} disabled={!slackActive || slackLoading} className={btnSlack}>
            {slackLoading ? "Sending…" : "Send Slack Notification"}
          </button>
          {slackSuccess && <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">Slack notification sent.</p>}
          {slackError && <p className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">{slackError}</p>}
        </section>
    </div>
  );
}
