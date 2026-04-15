import raw from "@/lib/data/tabibiPmidDatabaseCwV6.json";

export type TabibiPmidEntry = {
  entry_id: string;
  tier: string;
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  year: number;
  volume?: string | null;
  issue?: string | null;
  pages?: string | null;
  doi?: string | null;
  url: string;
  claim_language: string;
  abstract_summary: string;
  topic_tags: string[];
  use_for_sections: string[];
};

type RawRoot = {
  metadata?: {
    name?: string;
    version?: string;
    date?: string;
    tier_claim_language?: Record<string, string>;
    total_entries?: number;
  };
  pmid_database: TabibiPmidEntry[];
};

const root = raw as RawRoot;
const ALL: TabibiPmidEntry[] = Array.isArray(root.pmid_database) ? root.pmid_database : [];

const TIER_ORDER: Record<string, number> = {
  T1: 0,
  T2: 1,
  T3a: 2,
  T3b: 3,
  T4: 4,
};

function tierSortKey(tier: string): number {
  return TIER_ORDER[tier] ?? 50;
}

/** Words longer than `minLen` chars, lowercased, deduped. */
function queryTokens(...parts: (string | undefined)[]): Set<string> {
  const s = parts.filter(Boolean).join(" ").toLowerCase();
  const out = new Set<string>();
  for (const w of s.split(/[^a-z0-9]+/)) {
    if (w.length >= 3) out.add(w);
  }
  return out;
}

function scoreEntry(tokens: Set<string>, e: TabibiPmidEntry): number {
  let score = 0;
  const blob = [
    e.title,
    e.abstract_summary,
    ...e.topic_tags,
    ...e.use_for_sections,
    e.journal,
  ]
    .join(" ")
    .toLowerCase();

  for (const t of Array.from(tokens)) {
    if (t.length < 3) continue;
    if (blob.includes(t)) score += 4;
  }
  for (const tag of e.topic_tags) {
    const tl = tag.toLowerCase();
    for (const tok of Array.from(tokens)) {
      if (tok.length >= 4 && (tl.includes(tok) || tok.includes(tl))) score += 3;
    }
  }
  for (const sec of e.use_for_sections) {
    const sl = sec.toLowerCase();
    for (const tok of Array.from(tokens)) {
      if (tok.length >= 4 && (sl.includes(tok) || tok.includes(sl))) score += 3;
    }
  }

  return score;
}

export function tabibiDatabaseEntryCount(): number {
  return ALL.length;
}

/**
 * Ranks Tabibi library entries by relevance to title, keywords, and optional briefs.
 * Returns up to `maxEntries` (default 14) for prompt injection; the model should cite at most 3 PMIDs in the article.
 */
export function selectRelevantTabibiEntries(
  title: string,
  keywords: string[],
  opts?: {
    editorialBrief?: string;
    contentAngle?: string;
    productTypeForLinks?: string;
    maxEntries?: number;
  }
): TabibiPmidEntry[] {
  const maxEntries = Math.min(24, Math.max(6, opts?.maxEntries ?? 14));
  const tokens = queryTokens(
    title,
    keywords.join(" "),
    opts?.editorialBrief,
    opts?.contentAngle,
    opts?.productTypeForLinks
  );

  if (ALL.length === 0) return [];

  const scored = ALL.map((e) => ({
    e,
    score: scoreEntry(tokens, e),
  }));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return tierSortKey(a.e.tier) - tierSortKey(b.e.tier);
  });

  const topScore = scored[0]?.score ?? 0;
  /** No lexical overlap with title/keywords/brief: fall back to tier-prioritized pool. */
  if (topScore < 1) {
    return [...ALL].sort((a, b) => tierSortKey(a.tier) - tierSortKey(b.tier)).slice(0, maxEntries);
  }

  const out: TabibiPmidEntry[] = [];
  const seen = new Set<string>();
  for (const { e } of scored) {
    if (out.length >= maxEntries) break;
    if (seen.has(e.pmid)) continue;
    seen.add(e.pmid);
    out.push(e);
  }
  return out;
}

function leadAuthorSurname(firstAuthor: string | undefined): string {
  if (!firstAuthor?.trim()) return "Author";
  const parts = firstAuthor.trim().split(/\s+/);
  return parts[0] ?? "Author";
}

/** Bibliographic line for Expert Insight / Sources (plain text; model adds HTML). */
export function formatTabibiCitationLine(e: TabibiPmidEntry): string {
  const lead = leadAuthorSurname(e.authors[0]);
  const vol = e.volume ? `${e.volume}` : "";
  const iss = e.issue ? `(${e.issue})` : "";
  const pp = e.pages ? `:${e.pages}` : "";
  const volIssPg = vol || iss || pp ? `, ${vol}${iss}${pp}` : "";
  return `${lead} et al. (${e.year}). ${e.title} ${e.journal}${volIssPg}.`;
}

/**
 * User-message block: mandatory PMID source list for Expert Insight + Sources (Weed Learn).
 */
export function buildTabibiLibraryUserBlock(entries: TabibiPmidEntry[]): string {
  if (entries.length === 0) {
    return `\n\n(Tabibi citation library file is empty or failed to load — do not add PubMed PMIDs in Expert Insight until a library is configured.)\n`;
  }

  const meta = root.metadata;
  const lines = entries.map((e, i) => {
    const cite = formatTabibiCitationLine(e);
    return [
      `${i + 1}. PMID ${e.pmid} [${e.tier}] (${e.claim_language})`,
      `   Citation: ${cite}`,
      `   PubMed: ${e.url}`,
      `   Summary: ${e.abstract_summary.slice(0, 320)}${e.abstract_summary.length > 320 ? "…" : ""}`,
      `   Tags: ${e.topic_tags.join(", ")}`,
    ].join("\n");
  });

  return `

----- TABIBI GOLD STANDARD CITATION LIBRARY (Expert Insight — mandatory PMID source) -----
Library: ${meta?.name ?? "Tabibi"} ${meta?.version ?? ""} (${meta?.date ?? ""}). Total entries in file: ${meta?.total_entries ?? ALL.length}.

RULES FOR THIS ARTICLE:
- You may cite ONLY the PMIDs listed below in Dr. Tabibi Expert Insight expert-cite lines. Do not use any other PMID or PubMed URL anywhere in the HTML. Do not write a Sources section — the server appends Sources using only PMIDs actually cited in Expert Insight boxes (no extras).
- Choose up to 3 distinct PMIDs from this list that best match the article title, keywords, and section claims. Place Expert Insight boxes next to the claims they support.
- Match study-type wording to each entry's evidence tier (${meta?.tier_claim_language ? "see tier tags on each line" : "T1 = RCT-style; T2 = reviews; T3/T4 = observational or preclinical"}). Use each line's claim_language to calibrate hedging (e.g. "demonstrates" vs "evidence suggests" vs "shown in preclinical models").
- Expert-cite lines must use the PubMed URL shown for that PMID (digits path only).

Ranked candidates for this topic (most relevant first):
${lines.join("\n\n")}
----- END TABIBI LIBRARY -----
`;
}
