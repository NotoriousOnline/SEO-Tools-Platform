import Link from "next/link";
import { getRegisteredTools } from "@/lib/toolRegistry";

export function Sidebar() {
  const tools = getRegisteredTools();

  return (
    <aside className="w-64 shrink-0 border-r border-gray-200 bg-white">
      <div className="flex h-full flex-col p-4">
        <Link href="/" className="mb-6 text-lg font-semibold text-gray-900">
          SEO Tools
        </Link>
        <nav className="flex flex-col gap-1">
          <Link
            href="/"
            className="rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            Home
          </Link>
          {tools.map((tool) => (
            <Link
              key={tool.id}
              href={`/tools/${tool.id}`}
              className="rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              {tool.name}
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
}
