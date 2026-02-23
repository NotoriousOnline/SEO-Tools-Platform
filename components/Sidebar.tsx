"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { tools } from "@/lib/toolRegistry";

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside className="flex w-64 shrink-0 flex-col bg-slate-900 shadow-xl">
      <div className="flex h-full flex-col p-6">
        <Link
          href="/"
          className="mb-10 flex items-center gap-3 text-xl font-bold tracking-tight text-white"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 text-sm font-bold text-white shadow-lg shadow-teal-500/25">
            S
          </span>
          SEO Tools
        </Link>
        <nav className="flex flex-col gap-1">
          <Link
            href="/"
            className={`rounded-xl px-4 py-3 text-sm font-medium transition-all ${
              isActive("/")
                ? "bg-teal-500/20 text-teal-300 shadow-inner"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
            }`}
          >
            Home
          </Link>
          {tools.map((tool) => {
            const href = `/tools/${tool.slug}`;
            return (
              <Link
                key={tool.slug}
                href={href}
                className={`rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                  isActive(href)
                    ? "bg-teal-500/20 text-teal-300 shadow-inner"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                {tool.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
