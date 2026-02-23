"use client";

import type { MeetingPayload, ActionItem, TaskResult } from "./types";

type Tab = "webhook" | "manual";

type Props = {
  activeTab: Tab;
  setActiveTab: (t: Tab) => void;
  meeting: MeetingPayload | null;
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
  onLoadAndProcess: () => void;
  onPushAsana: () => void;
  onCreateDraft: () => void;
  onNotifySlack: () => void;
};

export function MeetingToActionsUI(props: Props) {
  const {
    activeTab,
    setActiveTab,
    meeting,
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
    onLoadAndProcess,
    onPushAsana,
    onCreateDraft,
    onNotifySlack,
  } = props;

  const sectionCls = "rounded-2xl border border-slate-200 bg-white p-6 shadow-lg";
  const disabledCls = " opacity-50 pointer-events-none";
  const inputCls = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200";
  const btnPrimary = "rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 hover:shadow disabled:opacity-50";
  const btnSuccess = "rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow disabled:opacity-50";
  const btnSlack = "rounded-xl bg-purple-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-purple-800 hover:shadow disabled:opacity-50";

  return (
    <div className="space-y-6">
        <section className={sectionCls}>
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800">Incoming Meeting</h3>
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
            !meeting ? (
              <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-5">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-500" />
                <p className="text-sm font-medium text-amber-800">Waiting for Fathom webhook… Polling every 10 seconds.</p>
              </div>
            ) : (
              <div>
                <div className="space-y-2 rounded-xl bg-slate-50 p-5 text-sm">
                  <p><span className="font-semibold text-slate-600">Title:</span> <span className="text-slate-800">{meeting.meeting_title}</span></p>
                  <p><span className="font-semibold text-slate-600">Date:</span> <span className="text-slate-800">{meeting.date}</span></p>
                  <p><span className="font-semibold text-slate-600">Participants:</span> <span className="text-slate-800">{meeting.participants.length > 0 ? meeting.participants.join(", ") : "—"}</span></p>
                </div>
                <button onClick={onProcess} disabled={processLoading} className="mt-4 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 hover:shadow disabled:opacity-50">
                  {processLoading ? "Processing…" : "Process with Claude"}
                </button>
                {processError && <p className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">{processError}</p>}
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
                          <button key={p} type="button" onClick={() => updateAction(i, { priority: p as "High" | "Medium" | "Low" })} className={action.priority === p ? "rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm" : "rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-300"}>
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
              <button onClick={onPushAsana} disabled={asanaLoading || actions.length === 0} className={btnSuccess}>
                {asanaLoading ? "Pushing…" : "Push All to Asana"}
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
              <div className="flex flex-wrap gap-3">
                <button onClick={onCreateDraft} disabled={draftLoading} className={btnPrimary}>
                  {draftLoading ? "Creating…" : "Create Gmail Draft"}
                </button>
                {gmailLink && <a href={gmailLink} target="_blank" rel="noopener noreferrer" className="rounded-xl border-2 border-indigo-200 px-4 py-2.5 text-sm font-semibold text-indigo-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50">Open in Gmail</a>}
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
