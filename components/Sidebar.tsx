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
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white shadow-sm">
      <div className="flex h-full flex-col p-5">
        <Link
          href="/"
          className="mb-8 flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-semibold text-white">
            S
          </span>
          SEO Tools
        </Link>
        <nav className="flex flex-col gap-0.5">
          <Link
            href="/"
            className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive("/")
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
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
                className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive(href)
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
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
