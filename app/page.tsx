import Link from "next/link";
import { tools } from "@/lib/toolRegistry";

export default function HomePage() {
  return (
    <div className="p-8 lg:p-10">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Welcome to SEO Tools
        </h1>
        <p className="mt-2 text-slate-600">
          Analyze, optimize, and improve website search performance with our suite of tools.
        </p>
      </div>
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Available Tools
        </h2>
        {tools.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool) => (
              <Link
                key={tool.slug}
                href={`/tools/${tool.slug}`}
                className="group flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md"
              >
                <span className="font-semibold text-slate-900 group-hover:text-indigo-600">
                  {tool.name}
                </span>
                {tool.description && (
                  <p className="mt-2 text-sm text-slate-500">{tool.description}</p>
                )}
                <span className="mt-4 text-sm font-medium text-indigo-600 opacity-0 transition-opacity group-hover:opacity-100">
                  Open tool →
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
            No tools registered yet.
          </p>
        )}
      </section>
    </div>
  );
}
