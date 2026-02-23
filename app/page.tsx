import Link from "next/link";
import { tools } from "@/lib/toolRegistry";

export default function HomePage() {
  return (
    <div className="p-8 lg:p-12">
      <div className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
          Welcome to SEO Tools
        </h1>
        <p className="mt-3 text-lg text-slate-600">
          Analyze, optimize, and improve website search performance with our suite of tools.
        </p>
      </div>
      <section>
        <h2 className="mb-6 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Available Tools
        </h2>
        {tools.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool) => (
              <Link
                key={tool.slug}
                href={`/tools/${tool.slug}`}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 shadow-lg transition-all hover:border-teal-200 hover:shadow-xl hover:-translate-y-0.5"
              >
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
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
            <p className="text-slate-500">No tools registered yet.</p>
          </div>
        )}
      </section>
    </div>
  );
}
