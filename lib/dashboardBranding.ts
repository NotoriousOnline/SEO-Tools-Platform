/**
 * Dashboard shell: app name, taglines, and per-tool accents (nav + cards + tool header).
 */
export const dashboard = {
  appName: "Content Studio",
  /** Shown in sidebar next to logo */
  appNameShort: "Studio",
  tagline:
    "Article discovery, SEO content, and WordPress publishing—each tool with its own workflow.",
  logoLetter: "C",
} as const;

/** Short labels for home cards (in addition to the full tool title from registry). */
export const toolDashboardLabel: Record<string, string> = {
  "article-title-discovery": "Ideas & angles",
  "content-production": "Publish anywhere",
  "weed-com-content-production": "Weed.com editorial",
};

type ToolTheme = {
  /** Left rule on tool page header */
  headerAccent: string;
  /** Home card blob gradient */
  cardBlob: string;
  cardBorderHover: string;
  cardTitleHover: string;
  cardCta: string;
  /** Sidebar link when this tool is active */
  navActive: string;
  navIdle: string;
  /** ToolLayout description subtle tint */
  descriptionClass: string;
};

const defaultTheme: ToolTheme = {
  headerAccent: "border-l-4 border-indigo-400",
  cardBlob: "from-indigo-200 to-violet-100",
  cardBorderHover: "hover:border-indigo-200",
  cardTitleHover: "group-hover:text-indigo-600",
  cardCta: "text-indigo-600",
  navActive: "bg-indigo-500/25 text-indigo-200 shadow-inner",
  navIdle: "text-slate-400 hover:bg-white/5 hover:text-slate-200",
  descriptionClass: "text-slate-600",
};

const themes: Record<string, ToolTheme> = {
  "article-title-discovery": {
    headerAccent: "border-l-4 border-violet-500",
    cardBlob: "from-violet-200 to-fuchsia-100",
    cardBorderHover: "hover:border-violet-200",
    cardTitleHover: "group-hover:text-violet-700",
    cardCta: "text-violet-600",
    navActive: "bg-violet-500/25 text-violet-200 shadow-inner",
    navIdle: "text-slate-400 hover:bg-white/5 hover:text-violet-200/90",
    descriptionClass: "text-violet-950/70",
  },
  "content-production": {
    headerAccent: "border-l-4 border-sky-500",
    cardBlob: "from-sky-200 to-cyan-100",
    cardBorderHover: "hover:border-sky-200",
    cardTitleHover: "group-hover:text-sky-700",
    cardCta: "text-sky-600",
    navActive: "bg-sky-500/25 text-sky-200 shadow-inner",
    navIdle: "text-slate-400 hover:bg-white/5 hover:text-sky-200/90",
    descriptionClass: "text-sky-950/70",
  },
  "weed-com-content-production": {
    headerAccent: "border-l-4 border-emerald-500",
    cardBlob: "from-emerald-200 to-teal-100",
    cardBorderHover: "hover:border-emerald-200",
    cardTitleHover: "group-hover:text-emerald-800",
    cardCta: "text-emerald-600",
    navActive: "bg-emerald-500/25 text-emerald-200 shadow-inner",
    navIdle: "text-slate-400 hover:bg-white/5 hover:text-emerald-200/90",
    descriptionClass: "text-emerald-950/70",
  },
};

export function getToolTheme(slug: string): ToolTheme {
  return themes[slug] ?? defaultTheme;
}

export function homeNavClasses(isActive: boolean): string {
  const base = "rounded-xl px-4 py-3 text-sm font-medium transition-all";
  if (isActive) {
    return `${base} bg-indigo-500/20 text-indigo-200 shadow-inner`;
  }
  return `${base} text-slate-400 hover:bg-white/5 hover:text-indigo-200/90`;
}

export function toolNavClasses(slug: string, isActive: boolean): string {
  const t = getToolTheme(slug);
  const base = "rounded-xl px-4 py-3 text-sm font-medium transition-all";
  if (isActive) {
    return `${base} ${t.navActive}`;
  }
  return `${base} ${t.navIdle}`;
}
