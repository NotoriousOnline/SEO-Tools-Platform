/**
 * Dashboard shell: app name, taglines, and per-tool accents (nav + cards + tool header).
 * Palette: slate + cyan + fuchsia — “AI agents / command center” aesthetic.
 */
export const dashboard = {
  appName: "Agent Console",
  /** Shown in sidebar next to logo */
  appNameShort: "Agents",
  tagline:
    "Orchestrate AI agents for meetings, content, and workflows—each runs with its own tools, prompts, and guardrails.",
  logoLetter: "A",
  heroTitle: "AI agent tools dashboard",
  sectionLabel: "Agent workflows",
  navOverview: "Command",
  navAgents: "Active agents",
  sidebarFooter:
    "API keys stay on the server—agents never expose secrets in the browser.",
} as const;

/** Short labels for home cards (in addition to the full tool title from registry). */
export const toolDashboardLabel: Record<string, string> = {
  "meeting-to-actions": "Meetings & tasks",
  "article-title-discovery": "Ideas & angles",
  "content-production": "Publish anywhere",
  "weed-com-content-production": "Weed.com editorial",
};

/** Tokens for sidebar nav rows (active bar, row bg, icon box). */
export type SidebarNavTokens = {
  bar: string;
  rowActive: string;
  rowIdle: string;
  iconActive: string;
  iconIdle: string;
};

export const homeSidebarNav: SidebarNavTokens = {
  bar: "bg-cyan-400",
  rowActive:
    "bg-cyan-500/[0.14] text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] ring-1 ring-cyan-400/20",
  rowIdle: "text-slate-400 hover:bg-white/[0.05] hover:text-cyan-200/90",
  iconActive: "bg-cyan-500/35 text-cyan-50 ring-1 ring-cyan-300/30 shadow-inner",
  iconIdle: "bg-white/[0.06] text-slate-500 group-hover:bg-cyan-500/10 group-hover:text-cyan-200",
};

type ToolTheme = {
  headerAccent: string;
  cardBlob: string;
  cardBorderHover: string;
  cardTitleHover: string;
  cardCta: string;
  descriptionClass: string;
  sidebarNav: SidebarNavTokens;
};

const defaultTheme: ToolTheme = {
  headerAccent: "border-l-4 border-cyan-500",
  cardBlob: "from-cyan-300/90 to-fuchsia-200/80",
  cardBorderHover: "hover:border-cyan-300/70",
  cardTitleHover: "group-hover:text-cyan-800",
  cardCta: "text-cyan-600",
  descriptionClass: "text-slate-600",
  sidebarNav: {
    bar: "bg-cyan-400",
    rowActive:
      "bg-cyan-500/[0.14] text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] ring-1 ring-cyan-400/20",
    rowIdle: "text-slate-400 hover:bg-white/[0.05] hover:text-cyan-200/90",
    iconActive: "bg-cyan-500/35 text-cyan-50 ring-1 ring-cyan-300/30",
    iconIdle: "bg-white/[0.06] text-slate-500 group-hover:text-cyan-200",
  },
};

const themes: Record<string, ToolTheme> = {
  "meeting-to-actions": {
    headerAccent: "border-l-4 border-fuchsia-500",
    cardBlob: "from-fuchsia-200/90 to-cyan-200/70",
    cardBorderHover: "hover:border-fuchsia-300/70",
    cardTitleHover: "group-hover:text-fuchsia-900",
    cardCta: "text-fuchsia-700",
    descriptionClass: "text-slate-600",
    sidebarNav: {
      bar: "bg-fuchsia-500",
      rowActive:
        "bg-fuchsia-500/[0.18] text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] ring-1 ring-fuchsia-400/25",
      rowIdle: "text-slate-400 hover:bg-white/[0.05] hover:text-fuchsia-200/90",
      iconActive: "bg-fuchsia-500/40 text-fuchsia-50 ring-1 ring-fuchsia-300/35",
      iconIdle: "bg-white/[0.06] text-slate-500 group-hover:text-fuchsia-200",
    },
  },
  "article-title-discovery": {
    headerAccent: "border-l-4 border-violet-500",
    cardBlob: "from-violet-200 to-fuchsia-100",
    cardBorderHover: "hover:border-violet-200",
    cardTitleHover: "group-hover:text-violet-700",
    cardCta: "text-violet-600",
    descriptionClass: "text-violet-950/70",
    sidebarNav: {
      bar: "bg-violet-400",
      rowActive:
        "bg-violet-500/[0.22] text-violet-50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] ring-1 ring-violet-400/25",
      rowIdle: "text-slate-400 hover:bg-white/[0.05] hover:text-violet-200",
      iconActive: "bg-violet-500/45 text-violet-50 ring-1 ring-violet-300/30",
      iconIdle: "bg-white/[0.06] text-slate-500 group-hover:text-violet-200",
    },
  },
  "content-production": {
    headerAccent: "border-l-4 border-sky-500",
    cardBlob: "from-sky-200 to-cyan-100",
    cardBorderHover: "hover:border-sky-200",
    cardTitleHover: "group-hover:text-sky-700",
    cardCta: "text-sky-600",
    descriptionClass: "text-sky-950/70",
    sidebarNav: {
      bar: "bg-sky-400",
      rowActive:
        "bg-sky-500/[0.22] text-sky-50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] ring-1 ring-sky-400/25",
      rowIdle: "text-slate-400 hover:bg-white/[0.05] hover:text-sky-200",
      iconActive: "bg-sky-500/45 text-sky-50 ring-1 ring-sky-300/30",
      iconIdle: "bg-white/[0.06] text-slate-500 group-hover:text-sky-200",
    },
  },
  "weed-com-content-production": {
    headerAccent: "border-l-4 border-emerald-500",
    cardBlob: "from-emerald-200 to-teal-100",
    cardBorderHover: "hover:border-emerald-200",
    cardTitleHover: "group-hover:text-emerald-800",
    cardCta: "text-emerald-600",
    descriptionClass: "text-emerald-950/70",
    sidebarNav: {
      bar: "bg-emerald-400",
      rowActive:
        "bg-emerald-500/[0.22] text-emerald-50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] ring-1 ring-emerald-400/25",
      rowIdle: "text-slate-400 hover:bg-white/[0.05] hover:text-emerald-200",
      iconActive: "bg-emerald-500/45 text-emerald-50 ring-1 ring-emerald-300/30",
      iconIdle: "bg-white/[0.06] text-slate-500 group-hover:text-emerald-200",
    },
  },
};

export function getToolTheme(slug: string): ToolTheme {
  return themes[slug] ?? defaultTheme;
}

export function getSidebarNav(slug: "home" | string): SidebarNavTokens {
  if (slug === "home") return homeSidebarNav;
  return getToolTheme(slug).sidebarNav;
}
