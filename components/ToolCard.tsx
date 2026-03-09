"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ToolConfig } from "@/lib/toolRegistry";
import { PasswordGatePopup } from "./PasswordGatePopup";

type ToolCardProps = {
  tool: ToolConfig;
};

export function ToolCard({ tool }: ToolCardProps) {
  const router = useRouter();
  const [showPasswordPopup, setShowPasswordPopup] = useState(false);

  const href = `/tools/${tool.slug}`;

  const handleClick = (e: React.MouseEvent) => {
    if (tool.requiresPassword) {
      e.preventDefault();
      setShowPasswordPopup(true);
    }
  };

  const handlePasswordSuccess = () => {
    setShowPasswordPopup(false);
    router.push(href);
  };

  const cardContent = (
    <>
      <div className="absolute top-0 right-0 h-24 w-24 translate-x-6 -translate-y-6 rounded-full bg-gradient-to-br from-teal-100 to-teal-50 opacity-60" />
      <span className="relative text-lg font-semibold text-slate-900 transition-colors group-hover:text-teal-600">
        {tool.name}
      </span>
      {tool.description && (
        <p className="relative mt-3 text-sm leading-relaxed text-slate-500">{tool.description}</p>
      )}
      <span className="relative mt-6 inline-flex items-center text-sm font-medium text-teal-600 opacity-0 transition-all group-hover:opacity-100">
        Open tool
        <svg className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
      </span>
    </>
  );

  return (
    <>
      {tool.requiresPassword ? (
        <button
          type="button"
          onClick={handleClick}
          className="group relative flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-lg transition-all hover:border-teal-200 hover:shadow-xl hover:-translate-y-0.5 sm:p-8"
        >
          {cardContent}
        </button>
      ) : (
        <Link
          href={href}
          className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-lg transition-all hover:border-teal-200 hover:shadow-xl hover:-translate-y-0.5 sm:p-8"
        >
          {cardContent}
        </Link>
      )}
      {showPasswordPopup && (
        <PasswordGatePopup
          toolName={tool.name}
          onSuccess={handlePasswordSuccess}
          onClose={() => setShowPasswordPopup(false)}
        />
      )}
    </>
  );
}
