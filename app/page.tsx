import { tools } from "@/lib/toolRegistry";
import { ToolCard } from "@/components/ToolCard";

export default function HomePage() {
  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-12">
      <div className="mb-8 md:mb-12">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
          Welcome to SEO Tools
        </h1>
        <p className="mt-2 text-base text-slate-600 sm:mt-3 sm:text-lg">
          Analyze, optimize, and improve website search performance with our suite of tools.
        </p>
      </div>
      <section>
        <h2 className="mb-6 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Available Tools
        </h2>
        {tools.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {tools.map((tool) => (
              <ToolCard key={tool.slug} tool={tool} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 text-center sm:p-12">
            <p className="text-slate-500">No tools registered yet.</p>
          </div>
        )}
      </section>
    </div>
  );
}
