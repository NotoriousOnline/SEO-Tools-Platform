/**
 * Internal link library (Supabase `site_internal_links`)
 *
 * **Per-site isolation:** Every row has `wp_site_id` → `wp_sites.id`. All reads/writes filter by that
 * UUID, so green.org and weed.com (different `wp_sites` rows) never share URLs in queries.
 *
 * **Posts vs products (same site):** `kind` is `post` | `page` | `product` | `other`. Post sync only
 * deletes/reinserts rows with `kind` in (`post`, `page`), so a future WooCommerce product sync can
 * own `kind = product` without being wiped by “sync posts”.
 */
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSiteById, type WPToolScope } from "@/lib/wpSites";
import { fetchAllPostsForLinkLibrary, type WPPostListItem } from "@/lib/wordpressClient";

export type LinkCandidate = { title: string; url: string };

/** Rows replaced only by WordPress post/page sync — never delete `product` here. */
const POST_PAGE_KINDS = ["post", "page"] as const;

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function scoreTextAgainstPhrases(text: string, phrases: string[]): number {
  const t = text.toLowerCase();
  let score = 0;
  for (const phrase of phrases) {
    const p = phrase.trim().toLowerCase();
    if (!p) continue;
    if (t.includes(p)) score += 3;
    for (const word of p.split(/\s+/)) {
      if (word.length < 3) continue;
      if (t.includes(word)) score += 1;
    }
  }
  return score;
}

/** Title + keywords + short excerpt/slug string. */
function scoreRow(
  row: { title: string; slug: string | null; excerpt: string | null; search_text: string | null },
  keywords: string[],
  articleTitle: string
): number {
  const blob = [row.title, row.slug, row.excerpt, row.search_text].filter(Boolean).join(" ");
  const phrases = [...keywords, articleTitle].filter((s) => typeof s === "string" && s.trim().length > 0);
  return scoreTextAgainstPhrases(blob, phrases);
}

/**
 * Pick up to `count` candidates with unique URLs, sorted by relevance.
 * When scores tie or all zero, rotate starting index by hash of title so similar articles don't always get the same set.
 */
export function pickDiverseLinkCandidates(
  rows: { title: string; url: string; slug: string | null; excerpt: string | null; search_text: string | null }[],
  keywords: string[],
  articleTitle: string,
  count: number
): LinkCandidate[] {
  if (rows.length === 0) return [];

  const scored = rows.map((r) => ({
    row: r,
    score: scoreRow(r, keywords, articleTitle),
  }));
  scored.sort((a, b) => b.score - a.score);

  const positive = scored.filter((s) => s.score > 0);
  const pool = positive.length > 0 ? positive : scored;

  let start = 0;
  if (positive.length === 0) {
    let h = 0;
    for (let i = 0; i < articleTitle.length; i++) h = (h * 31 + articleTitle.charCodeAt(i)) >>> 0;
    start = h % Math.max(1, pool.length);
  }

  const out: LinkCandidate[] = [];
  const seenUrl = new Set<string>();
  const n = pool.length;

  for (let i = 0; i < n && out.length < count; i++) {
    const idx = (start + i) % n;
    const { row } = pool[idx];
    const url = row.url.trim();
    if (!url || seenUrl.has(url)) continue;
    seenUrl.add(url);
    out.push({ title: row.title || "Untitled", url });
  }

  return out;
}

export async function fetchLibraryRowsForSite(wpSiteId: string): Promise<
  { title: string; url: string; slug: string | null; excerpt: string | null; search_text: string | null }[]
> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("site_internal_links")
      .select("title, url, slug, excerpt, search_text")
      .eq("wp_site_id", wpSiteId);

    if (error) {
      if (error.code === "PGRST205" || (error.message && error.message.includes("Could not find"))) {
        return [];
      }
      console.warn("[siteLinkLibrary] select error:", error.message);
      return [];
    }
    return (data ?? []) as {
      title: string;
      url: string;
      slug: string | null;
      excerpt: string | null;
      search_text: string | null;
    }[];
  } catch (e) {
    console.warn("[siteLinkLibrary] fetch rows:", e);
    return [];
  }
}

/** Best-effort candidates from Supabase (empty if table missing or not synced yet). */
export async function getCandidatesFromLibrary(
  wpSiteId: string,
  keywords: string[],
  articleTitle: string,
  count: number
): Promise<LinkCandidate[]> {
  const rows = await fetchLibraryRowsForSite(wpSiteId);
  return pickDiverseLinkCandidates(rows, keywords, articleTitle, count);
}

function mapWpPostToRows(wpSiteId: string, posts: WPPostListItem[]) {
  const now = new Date().toISOString();
  return posts.map((p) => {
    const title = stripHtml(p.title?.rendered ?? "") || p.slug || "Untitled";
    const excerpt = stripHtml(p.excerpt?.rendered ?? "");
    const searchBlob = [title, p.slug, excerpt].filter(Boolean).join(" ").slice(0, 8000);
    return {
      wp_site_id: wpSiteId,
      wp_post_id: p.id,
      url: p.link,
      title,
      slug: p.slug ?? null,
      kind: "post" as const,
      excerpt: excerpt || null,
      search_text: searchBlob || null,
      source_updated_at: now,
    };
  });
}

const SYNC_CHUNK = 200;

/** Replace all post/page link rows for this site with fresh data from WordPress (all pages, up to safety cap). */
export async function syncInternalLinksFromWordPress(
  wpSiteId: string,
  toolScope: WPToolScope
): Promise<{ count: number }> {
  const site = await getSiteById(wpSiteId, toolScope);
  if (!site) {
    throw new Error("Site not found");
  }

  const all = await fetchAllPostsForLinkLibrary(site);

  const sb = getSupabaseAdmin();
  const { error: delErr } = await sb
    .from("site_internal_links")
    .delete()
    .eq("wp_site_id", wpSiteId)
    .in("kind", [...POST_PAGE_KINDS]);
  if (delErr) {
    if (delErr.code === "PGRST205" || (delErr.message && delErr.message.includes("Could not find"))) {
      throw new Error(
        'Table "site_internal_links" was not found. Run supabase/migrations/005_site_internal_links.sql in the Supabase SQL editor.'
      );
    }
    throw delErr;
  }

  const rows = mapWpPostToRows(wpSiteId, all);
  for (let i = 0; i < rows.length; i += SYNC_CHUNK) {
    const chunk = rows.slice(i, i + SYNC_CHUNK);
    const { error: insErr } = await sb.from("site_internal_links").insert(chunk);
    if (insErr) throw insErr;
  }

  return { count: rows.length };
}

/** Live WordPress fallback when the library is empty or unavailable. */
export function pickCandidatesFromLivePosts(
  posts: { title: { rendered: string }; link: string; slug: string }[],
  keywords: string[],
  articleTitle: string,
  count: number
): LinkCandidate[] {
  const rows = posts.map((p) => ({
    title: stripHtml(p.title?.rendered ?? p.slug),
    url: p.link,
    slug: p.slug,
    excerpt: null as string | null,
    search_text: `${p.slug} ${stripHtml(p.title?.rendered ?? "")}`.slice(0, 8000),
  }));
  return pickDiverseLinkCandidates(rows, keywords, articleTitle, count);
}
