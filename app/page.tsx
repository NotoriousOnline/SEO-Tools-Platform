import { tools } from "@/lib/toolRegistry";
import { ToolCard } from "@/components/ToolCard";
import { dashboard } from "@/lib/dashboardBranding";

export default function HomePage() {
  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-12">
      <div className="mb-8 md:mb-12">
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-600">
          {dashboard.appName}
        </p>
        <h1 className="mt-2 bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-900 bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-3xl lg:text-4xl">
          {dashboard.heroTitle}
        </h1>
        <p className="mt-2 max-w-2xl text-base text-slate-600 sm:mt-3 sm:text-lg">
          {dashboard.tagline}
        </p>
      </div>
      <section>
        <h2 className="mb-6 text-xs font-semibold uppercase tracking-widest text-fuchsia-600/90">
          {dashboard.sectionLabel}
        </h2>
        {tools.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {tools.map((tool) => (
              <ToolCard key={tool.slug} tool={tool} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-cyan-300/60 bg-white/70 p-8 text-center shadow-inner shadow-cyan-900/5 sm:p-12">
            <p className="text-slate-500">No agents registered yet.</p>
          </div>
        )}
      </section>
    </div>
  );
}
