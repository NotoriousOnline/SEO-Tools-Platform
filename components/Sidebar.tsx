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
    <aside className="w-64 shrink-0 border-r border-gray-200 bg-white">
      <div className="flex h-full flex-col p-4">
        <Link href="/" className="mb-6 text-lg font-semibold text-gray-900">
          SEO Tools
        </Link>
        <nav className="flex flex-col gap-1">
          <Link
            href="/"
            className={`rounded-md px-3 py-2 text-sm ${
              isActive("/")
                ? "bg-gray-100 font-medium text-gray-900"
                : "text-gray-700 hover:bg-gray-100"
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
                className={`rounded-md px-3 py-2 text-sm ${
                  isActive(href)
                    ? "bg-gray-100 font-medium text-gray-900"
                    : "text-gray-700 hover:bg-gray-100"
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
