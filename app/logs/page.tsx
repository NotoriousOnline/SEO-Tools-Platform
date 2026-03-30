"use client";

import { useCallback, useEffect, useState } from "react";
import { dashboard } from "@/lib/dashboardBranding";

type LogRow = {
  id: string;
  created_at: string;
  level: string;
  source: string;
  message: string;
  meta: Record<string, unknown> | null;
};

export default function LogsPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [filter, setFilter] = useState<"" | "error" | "warn" | "info">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = filter ? `?level=${filter}&limit=200` : "?limit=200";
      const res = await fetch(`/api/logs${q}`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setAuthed(false);
        setLogs([]);
        return;
      }
      if (res.status === 503 && typeof data.error === "string" && data.error.includes("disabled")) {
        setError(data.error);
        setAuthed(null);
        return;
      }
      if (!res.ok) {
        setAuthed(true);
        setLogs([]);
        setError(typeof data.error === "string" ? data.error : "Could not load logs");
        return;
      }
      setAuthed(true);
      setError(null);
      setLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch {
      setError("Network error loading logs");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch("/api/logs/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Sign-in failed");
        return;
      }
      setPassword("");
      setAuthed(true);
      await fetchLogs();
    } catch {
      setError("Network error");
    }
  }

  async function handleLogout() {
    await fetch("/api/logs/logout", { method: "POST", credentials: "include" });
    setAuthed(false);
    setLogs([]);
  }

  function levelBadge(level: string) {
    const base = "inline-flex rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wide";
    if (level === "error") return `${base} bg-rose-100 text-rose-800`;
    if (level === "warn") return `${base} bg-amber-100 text-amber-900`;
    return `${base} bg-slate-200 text-slate-700`;
  }

  if (authed === false) {
    return (
      <div className="p-4 sm:p-6 md:p-8 lg:p-12">
        <div className="mx-auto max-w-md rounded-2xl border border-amber-200/80 bg-white/90 p-6 shadow-lg shadow-amber-900/5 backdrop-blur sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-700/90">{dashboard.appName}</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Server logs</h1>
          <p className="mt-2 text-sm text-slate-600">
            Enter the viewer password configured as <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">LOGS_VIEWER_PASSWORD</code> on
            the server (e.g. Vercel).
          </p>
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label htmlFor="logs-pw" className="sr-only">
                Password
              </label>
              <input
                id="logs-pw"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-inner outline-none ring-amber-400/40 focus:ring-2"
                placeholder="Viewer password"
              />
            </div>
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 py-3 text-sm font-semibold text-white shadow-md shadow-amber-600/25 transition hover:from-amber-600 hover:to-orange-700"
            >
              View logs
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-12">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between md:mb-8">
        <div className="border-l-4 border-amber-500 pl-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-700/90">{dashboard.appName}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Server logs</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
            Recent errors and warnings from API routes (stored in Supabase). Use this after a failed publish or discovery run in production.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none ring-amber-400/30 focus:ring-2"
          >
            <option value="">All levels</option>
            <option value="error">Errors only</option>
            <option value="warn">Warnings</option>
            <option value="info">Info</option>
          </select>
          <button
            type="button"
            onClick={() => void fetchLogs()}
            disabled={loading}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      ) : null}

      {authed === null && !error ? (
        <p className="text-sm text-slate-500">Checking access…</p>
      ) : null}

      {authed && logs.length === 0 && !loading ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-10 text-center text-slate-600">
          No log rows yet. Errors from API routes will appear here after you run a workflow or apply the migration.
        </div>
      ) : null}

      {authed && logs.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm">
          <div className="max-h-[min(70vh,720px)] overflow-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100/95 text-xs font-semibold uppercase tracking-wide text-slate-600 backdrop-blur">
                <tr>
                  <th className="px-4 py-3">Time (UTC)</th>
                  <th className="px-4 py-3">Level</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {logs.map((row) => (
                  <tr key={row.id} className="align-top hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-500">
                      {new Date(row.created_at).toISOString().replace("T", " ").slice(0, 19)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={levelBadge(row.level)}>{row.level}</span>
                    </td>
                    <td className="max-w-[140px] truncate px-4 py-3 font-mono text-xs text-slate-600" title={row.source}>
                      {row.source}
                    </td>
                    <td className="px-4 py-3 text-slate-800">
                      <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-relaxed">{row.message}</pre>
                      {row.meta && Object.keys(row.meta).length > 0 ? (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => setExpanded((prev) => ({ ...prev, [row.id]: !prev[row.id] }))}
                            className="text-xs font-medium text-amber-700 underline-offset-2 hover:underline"
                          >
                            {expanded[row.id] ? "Hide details" : "Show details"}
                          </button>
                          {expanded[row.id] ? (
                            <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-slate-900/95 p-3 font-mono text-xs text-emerald-100">
                              {JSON.stringify(row.meta, null, 2)}
                            </pre>
                          ) : null}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
