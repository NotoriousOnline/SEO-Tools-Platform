"use client";

import Link from "next/link";
import type { ToolConfig } from "@/lib/toolRegistry";
import { getToolTheme, toolDashboardLabel } from "@/lib/dashboardBranding";

type ToolCardProps = {
  tool: ToolConfig;
};

export function ToolCard({ tool }: ToolCardProps) {
  const href = `/tools/${tool.slug}`;
  const theme = getToolTheme(tool.slug);
  const label = toolDashboardLabel[tool.slug];

  return (
    <Link
      href={href}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-lg transition-all ${theme.cardBorderHover} hover:shadow-xl hover:-translate-y-0.5 sm:p-8`}
    >
      <div
        className={`absolute top-0 right-0 h-24 w-24 translate-x-6 -translate-y-6 rounded-full bg-gradient-to-br ${theme.cardBlob} opacity-70`}
      />
      {label ? (
        <span className="relative mb-2 inline-flex w-fit rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
          {label}
        </span>
      ) : null}
      <span className={`relative text-lg font-semibold text-slate-900 transition-colors ${theme.cardTitleHover}`}>
        {tool.name}
      </span>
      {tool.description && (
        <p className="relative mt-3 text-sm leading-relaxed text-slate-500">{tool.description}</p>
      )}
      <span
        className={`relative mt-6 inline-flex items-center text-sm font-medium opacity-0 transition-all group-hover:opacity-100 ${theme.cardCta}`}
      >
        Open tool
        <svg className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
      </span>
    </Link>
  );
}
