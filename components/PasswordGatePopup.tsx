"use client";

import { useState, useRef } from "react";

const STORAGE_KEY = "tool_authenticated";

type PasswordGatePopupProps = {
  toolName: string;
  onSuccess: () => void;
  onClose?: () => void;
};

export function PasswordGatePopup({ toolName, onSuccess, onClose }: PasswordGatePopupProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUnlock = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { success?: boolean };
      if (data.success) {
        sessionStorage.setItem(STORAGE_KEY, "true");
        setPassword("");
        onSuccess();
      } else {
        setError("Incorrect password. Try again.");
        setPassword("");
        inputRef.current?.focus();
      }
    } catch {
      setError("Incorrect password. Try again.");
      setPassword("");
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-popup-title"
      >
        <div className="mb-6 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-7 w-7 text-slate-600"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
          </div>
        </div>
        <h2 id="password-popup-title" className="mb-6 text-center text-xl font-semibold text-slate-800">
          {toolName}
        </h2>
        <p className="mb-4 text-center text-sm text-slate-600">Enter password to access</p>
        <div className="space-y-4">
          <div>
            <label htmlFor="password-popup" className="mb-2 block text-sm font-medium text-slate-800">
              Enter access password
            </label>
            <input
              id="password-popup"
              ref={inputRef}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
              placeholder="Password"
              disabled={loading}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 placeholder-slate-400 transition-colors focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-200 disabled:opacity-50"
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <div className="flex gap-3">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={handleUnlock}
              disabled={loading || !password.trim()}
              className="flex-1 rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-teal-700 disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Verifying…
                </span>
              ) : (
                "Unlock"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
