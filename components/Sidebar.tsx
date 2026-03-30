"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { tools } from "@/lib/toolRegistry";
import { dashboard, homeNavClasses, toolNavClasses } from "@/lib/dashboardBranding";

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isHomeActive = pathname === "/";

  const isToolActive = (href: string) => pathname.startsWith(href);

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-indigo-900 text-white shadow-lg shadow-indigo-900/30 md:hidden"
        aria-label="Open menu"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-6 w-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-indigo-800/40 bg-gradient-to-b from-indigo-950 via-slate-900 to-indigo-950 shadow-xl transition-transform duration-300 ease-out md:relative md:inset-auto md:translate-x-0 md:shrink-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <span className="absolute right-4 top-4 md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white"
            aria-label="Close menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
        <div className="flex h-full flex-col p-6">
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            className="mb-10 flex items-center gap-3 text-xl font-bold tracking-tight text-white"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-700 text-sm font-bold text-white shadow-lg shadow-violet-600/30">
              {dashboard.logoLetter}
            </span>
            <span className="flex flex-col leading-tight">
              <span>{dashboard.appNameShort}</span>
              <span className="text-xs font-normal text-indigo-300/80">{dashboard.appName}</span>
            </span>
          </Link>
          <nav className="flex flex-col gap-1">
            <Link
              href="/"
              onClick={() => setMobileOpen(false)}
              className={homeNavClasses(isHomeActive)}
            >
              Home
            </Link>
            {tools.map((tool) => {
              const href = `/tools/${tool.slug}`;
              return (
                <Link
                  key={tool.slug}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={toolNavClasses(tool.slug, isToolActive(href))}
                >
                  {tool.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}
