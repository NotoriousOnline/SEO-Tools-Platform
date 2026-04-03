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
import {
  fetchAllPostsForLinkLibrary,
  fetchAllProductsForLinkLibrary,
  type WPPostListItem,
  type WCProductListItem,
} from "@/lib/wordpressClient";

export type LinkCandidate = {
  title: string;
  url: string;
  imageUrl?: string | null;
  /** post/page = editorial in-body links; product = Shop Now cards. */
  linkKind?: "post" | "page" | "product" | "other";
};

/** Rows replaced only by WordPress post/page sync — never delete `product` here. */
const POST_PAGE_KINDS = ["post", "page"] as const;

/** Rows replaced only by WooCommerce product sync — never delete post/page here. */
const PRODUCT_KINDS = ["product"] as const;

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Weed.com: boost WooCommerce products whose catalog text matches preferred partner brands.
 * Binoid / Blazed warehouse inventory is scored when "warehouse" appears in product copy or URL.
 */
export function weedPreferredBrandBonus(blob: string): number {
  const t = blob.toLowerCase();
  let bonus = 0;
  if (/\bbinoid\b/i.test(t)) bonus += 55;
  if (/\bbloomz\b/i.test(t)) bonus += 55;
  if (/\bhometown\s*hero\b/i.test(t)) bonus += 55;
  if (/\bblazed\b/i.test(t)) bonus += 55;
  if (/\bcookies\b/i.test(t)) bonus += 55;
  if (/\bbinoid\b/i.test(t) && /warehouse/.test(t)) bonus += 25;
  if (/\bblazed\b/i.test(t) && /warehouse/.test(t)) bonus += 25;
  return bonus;
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

export type LinkLibraryRow = {
  title: string;
  url: string;
  slug: string | null;
  excerpt: string | null;
  search_text: string | null;
  kind: string | null;
  /** WooCommerce product thumbnail; null for posts/pages. */
  image_url?: string | null;
};

export type GetCandidatesOptions = {
  /** When set with a non-empty value, up to `productLinkSlots` product URLs are placed first in the candidate list. */
  productTypeHint?: string;
  /** Max product URLs to reserve (clamped 1–2). Default 2. */
  productLinkSlots?: number;
  /** Weed.com: rank product links higher when partner brands (Binoid, Bloomz, Hometown Hero, Blazed, Cookies, warehouse) match catalog text. */
  boostWeedPreferredProductBrands?: boolean;
  /** Minimum editorial post/page URLs to reserve when available (default 1). Set 0 to skip. */
  minPostPageSlots?: number;
  /** Max editorial post/page URLs to reserve (default 3, max 3). Set 0 to skip post reservation. */
  maxPostPageSlots?: number;
};

function inferLinkKind(row: { kind?: string | null }): NonNullable<LinkCandidate["linkKind"]> {
  const k = (row.kind ?? "").toLowerCase();
  if (k === "product") return "product";
  if (k === "page") return "page";
  if (k === "post") return "post";
  return "other";
}

function pushCandidate(
  out: LinkCandidate[],
  seen: Set<string>,
  r: LinkLibraryRow,
  linkKind: NonNullable<LinkCandidate["linkKind"]>
): boolean {
  const u = r.url.trim();
  if (!u || seen.has(u)) return false;
  seen.add(u);
  out.push({
    title: r.title || "Untitled",
    url: u,
    imageUrl: r.image_url?.trim() || undefined,
    linkKind,
  });
  return true;
}

/**
 * 1) Reserves most relevant editorial post/page URLs (default 1–3).
 * 2) Reserves product URLs when hint or Weed partner boost applies.
 * 3) Fills remaining slots with diverse high-scoring links.
 */
export function pickLinkCandidatesWithProductBias(
  rows: LinkLibraryRow[],
  keywords: string[],
  articleTitle: string,
  count: number,
  options?: GetCandidatesOptions
): LinkCandidate[] {
  const hint = options?.productTypeHint?.trim();
  const rawSlots = options?.productLinkSlots ?? 2;
  const weedBoost = options?.boostWeedPreferredProductBrands === true;

  const maxPostCfg = options?.maxPostPageSlots;
  const skipPosts = maxPostCfg === 0;
  const maxPost = skipPosts ? 0 : Math.min(3, maxPostCfg ?? 3);

  const productSlotCount = hint
    ? Math.min(2, Math.max(1, rawSlots))
    : weedBoost
      ? Math.min(2, Math.max(1, rawSlots))
      : 0;

  const isProduct = (r: LinkLibraryRow) => (r.kind ?? "").toLowerCase() === "product";
  const isPostPage = (r: LinkLibraryRow) => {
    const k = (r.kind ?? "").toLowerCase();
    return k === "post" || k === "page";
  };

  const seen = new Set<string>();
  const out: LinkCandidate[] = [];

  // 1) Editorial posts/pages — most relevant first (prompt: at least minPost when URLs exist, up to maxPost)
  if (!skipPosts && maxPost > 0) {
    const postPages = rows.filter(isPostPage);
    if (postPages.length > 0) {
      const scored = postPages
        .map((r) => ({ r, score: scoreRow(r, keywords, articleTitle) }))
        .sort((a, b) => b.score - a.score);
      let added = 0;
      for (const { r } of scored) {
        if (added >= maxPost) break;
        const lk = (r.kind ?? "").toLowerCase() === "page" ? "page" : "post";
        if (pushCandidate(out, seen, r, lk)) added += 1;
      }
    }
  }

  // 2) Products (partner brands / hint)
  if (productSlotCount > 0) {
    const products = rows.filter(isProduct);
    if (products.length > 0) {
      const scored = products.map((r) => {
        const blob = [r.title, r.slug, r.excerpt, r.search_text, r.url].filter(Boolean).join(" ");
        const base =
          scoreRow(r, keywords, articleTitle) + (weedBoost ? weedPreferredBrandBonus(blob) : 0);
        const hintScore = hint ? scoreTextAgainstPhrases(blob, [hint]) : 0;
        const hintBoost = hint ? hintScore * 3 : 0;
        return { r, score: base + hintBoost };
      });
      scored.sort((a, b) => b.score - a.score);
      let pAdded = 0;
      for (const { r } of scored) {
        if (pAdded >= productSlotCount) break;
        if (pushCandidate(out, seen, r, "product")) pAdded += 1;
      }
    }
  }

  const remaining = count - out.length;
  if (remaining <= 0) return out.slice(0, count);

  const others = rows.filter((r) => {
    const u = r.url.trim();
    return u && !seen.has(u);
  });
  const rest = pickDiverseLinkCandidates(others, keywords, articleTitle, remaining, {
    boostWeedPreferredProductBrands: weedBoost,
  });
  for (const c of rest) {
    if (out.length >= count) break;
    if (seen.has(c.url)) continue;
    seen.add(c.url);
    out.push({
      ...c,
      linkKind: c.linkKind ?? "other",
    });
  }

  return out;
}

export type PickDiverseOptions = {
  /** When true, WooCommerce product rows get Binoid/Bloomz/Hometown Hero/Blazed/Cookies relevance bonus. */
  boostWeedPreferredProductBrands?: boolean;
};

/**
 * Pick up to `count` candidates with unique URLs, sorted by relevance.
 * When scores tie or all zero, rotate starting index by hash of title so similar articles don't always get the same set.
 */
export function pickDiverseLinkCandidates(
  rows: {
    title: string;
    url: string;
    slug: string | null;
    excerpt: string | null;
    search_text: string | null;
    image_url?: string | null;
    kind?: string | null;
  }[],
  keywords: string[],
  articleTitle: string,
  count: number,
  options?: PickDiverseOptions
): LinkCandidate[] {
  if (rows.length === 0) return [];

  const weedBoost = options?.boostWeedPreferredProductBrands === true;
  const scored = rows.map((r) => {
    let score = scoreRow(r, keywords, articleTitle);
    if (weedBoost && (r.kind ?? "").toLowerCase() === "product") {
      const blob = [r.title, r.slug, r.excerpt, r.search_text, r.url].filter(Boolean).join(" ");
      score += weedPreferredBrandBonus(blob);
    }
    return { row: r, score };
  });
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
    out.push({
      title: row.title || "Untitled",
      url,
      imageUrl: row.image_url?.trim() || undefined,
      linkKind: inferLinkKind(row),
    });
  }

  return out;
}

export async function fetchLibraryRowsForSite(wpSiteId: string): Promise<LinkLibraryRow[]> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("site_internal_links")
      .select("title, url, slug, excerpt, search_text, kind, image_url")
      .eq("wp_site_id", wpSiteId);

    if (error) {
      if (error.code === "PGRST205" || (error.message && error.message.includes("Could not find"))) {
        return [];
      }
      console.warn("[siteLinkLibrary] select error:", error.message);
      return [];
    }
    return (data ?? []) as LinkLibraryRow[];
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
  count: number,
  options?: GetCandidatesOptions
): Promise<LinkCandidate[]> {
  const rows = await fetchLibraryRowsForSite(wpSiteId);
  return pickLinkCandidatesWithProductBias(rows, keywords, articleTitle, count, options);
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

function mapWcProductToRows(wpSiteId: string, products: WCProductListItem[]) {
  const now = new Date().toISOString();
  return products.map((p) => {
    const title = stripHtml(p.name ?? "") || p.slug || "Untitled";
    const excerpt = stripHtml(p.short_description ?? "");
    const searchBlob = [title, p.slug, excerpt].filter(Boolean).join(" ").slice(0, 8000);
    const imageSrc = p.images?.[0]?.src?.trim();
    return {
      wp_site_id: wpSiteId,
      wp_post_id: p.id,
      url: p.permalink,
      title,
      slug: p.slug ?? null,
      kind: "product" as const,
      excerpt: excerpt || null,
      search_text: searchBlob || null,
      image_url: imageSrc || null,
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

/** Replace all product link rows for this site with fresh data from WooCommerce REST. */
export async function syncProductInternalLinksFromWordPress(
  wpSiteId: string,
  toolScope: WPToolScope
): Promise<{ count: number }> {
  const site = await getSiteById(wpSiteId, toolScope);
  if (!site) {
    throw new Error("Site not found");
  }

  const all = await fetchAllProductsForLinkLibrary(site);

  const sb = getSupabaseAdmin();
  const { error: delErr } = await sb
    .from("site_internal_links")
    .delete()
    .eq("wp_site_id", wpSiteId)
    .in("kind", [...PRODUCT_KINDS]);
  if (delErr) {
    if (delErr.code === "PGRST205" || (delErr.message && delErr.message.includes("Could not find"))) {
      throw new Error(
        'Table "site_internal_links" was not found. Run supabase/migrations/005_site_internal_links.sql in the Supabase SQL editor.'
      );
    }
    throw delErr;
  }

  const rows = mapWcProductToRows(wpSiteId, all);
  for (let i = 0; i < rows.length; i += SYNC_CHUNK) {
    const chunk = rows.slice(i, i + SYNC_CHUNK);
    const { error: insErr } = await sb.from("site_internal_links").insert(chunk);
    if (insErr) throw insErr;
  }

  return { count: rows.length };
}

/** Live WordPress fallback when the library is empty or unavailable (posts only). */
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
    image_url: null as string | null,
    kind: "post" as const,
  }));
  return pickDiverseLinkCandidates(rows, keywords, articleTitle, count);
}

/**
 * Same as syncing Supabase: merge live posts + WooCommerce products so product URLs can appear in the prompt
 * when the link library is thin (with Weed partner-brand scoring when options say so).
 */
export function pickCandidatesFromLivePostsAndProducts(
  posts: { title: { rendered: string }; link: string; slug: string }[],
  products: WCProductListItem[] | undefined,
  keywords: string[],
  articleTitle: string,
  count: number,
  options?: GetCandidatesOptions
): LinkCandidate[] {
  const postRows: LinkLibraryRow[] = posts.map((p) => ({
    title: stripHtml(p.title?.rendered ?? p.slug),
    url: p.link,
    slug: p.slug ?? null,
    excerpt: null,
    search_text: `${p.slug} ${stripHtml(p.title?.rendered ?? "")}`.slice(0, 8000),
    kind: "post",
    image_url: null,
  }));
  const prodRows: LinkLibraryRow[] = (products ?? []).map((p) => {
    const title = stripHtml(p.name ?? "") || p.slug || "Untitled";
    const excerpt = stripHtml(p.short_description ?? "");
    const searchBlob = [title, p.slug, excerpt].filter(Boolean).join(" ").slice(0, 8000);
    const imageSrc = p.images?.[0]?.src?.trim();
    return {
      title,
      url: p.permalink,
      slug: p.slug ?? null,
      excerpt: excerpt || null,
      search_text: searchBlob || null,
      kind: "product",
      image_url: imageSrc || null,
    };
  });
  return pickLinkCandidatesWithProductBias([...postRows, ...prodRows], keywords, articleTitle, count, options);
}
