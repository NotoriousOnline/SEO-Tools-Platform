export type WPSite = {
  url: string;
  username: string;
  app_password: string;
};

/** Many CDNs/WAFs return 403 for Node/undici default User-Agent on /wp-json/. */
const WP_REST_USER_AGENT_BASE =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function wpRestUserAgent(): string {
  const full = (process.env.WORDPRESS_REST_USER_AGENT ?? "").trim();
  if (full) return full;
  const suffix = (process.env.WORDPRESS_REST_USER_AGENT_SUFFIX ?? "").trim();
  return suffix ? `${WP_REST_USER_AGENT_BASE} ${suffix}` : WP_REST_USER_AGENT_BASE;
}

/**
 * WordPress REST URL with optional WAF bypass query (e.g. bypass_key=secret) for Cloudflare allowlists.
 */
export function wpRestUrl(base: string, restPathAndQuery: string): string {
  const rawBase = (base ?? "").trim();
  const withProtocol = /^https?:\/\//i.test(rawBase) ? rawBase : `https://${rawBase}`;
  const parsed = new URL(withProtocol);
  const normalizedPath = parsed.pathname.replace(/\/$/, "");
  const trimmedBase = `${parsed.origin}${normalizedPath}`;
  const path = restPathAndQuery.replace(/^\//, "");
  const url = `${trimmedBase}/wp-json/${path}`;
  const bypass = (process.env.WORDPRESS_WAF_BYPASS_QUERY ?? "").trim();
  if (!bypass) return url;
  return url.includes("?") ? `${url}&${bypass}` : `${url}?${bypass}`;
}

function getWwwFallbackBase(base: string): string | null {
  try {
    const rawBase = (base ?? "").trim();
    const withProtocol = /^https?:\/\//i.test(rawBase) ? rawBase : `https://${rawBase}`;
    const u = new URL(withProtocol);
    if (u.hostname.startsWith("www.")) return null;
    if (!u.hostname.includes(".")) return null;
    u.hostname = `www.${u.hostname}`;
    return `${u.origin}${u.pathname}`.replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function getAuthHeader(site: WPSite): string {
  const creds = `${site.username.trim()}:${site.app_password.trim()}`;
  return `Basic ${Buffer.from(creds, "utf-8").toString("base64")}`;
}

/** Standard headers for WordPress REST (auth + browser-like UA). */
export function wpRestHeaders(site: WPSite, opts?: { contentTypeJson?: boolean }): Record<string, string> {
  const origin = site.url.replace(/\/$/, "");
  const h: Record<string, string> = {
    Authorization: getAuthHeader(site),
    Accept: "application/json",
    "User-Agent": wpRestUserAgent(),
    Referer: `${origin}/`,
  };
  const wafCookie = (process.env.WORDPRESS_WAF_BYPASS_COOKIE ?? "").trim();
  if (wafCookie) {
    h.Cookie = wafCookie;
  }
  if (opts?.contentTypeJson) {
    h["Content-Type"] = "application/json";
  }
  return h;
}

export type WPPostListItem = {
  id: number;
  title: { rendered: string };
  link: string;
  slug: string;
  excerpt?: { rendered?: string };
};

export async function getPosts(
  site: WPSite,
  limit: number
): Promise<{ id: number; title: { rendered: string }; link: string; slug: string }[]> {
  const base = site.url.replace(/\/$/, "");
  const res = await fetch(
    wpRestUrl(base, `wp/v2/posts?per_page=${limit}&_fields=id,title,link,slug`),
    { headers: wpRestHeaders(site) }
  );
  if (!res.ok) throw new Error(`WP getPosts failed: ${res.status}`);
  return res.json();
}

export type WPPostsPageHeaders = {
  posts: WPPostListItem[];
  /** From X-WP-Total; 0 if header missing. */
  total: number;
  /** From X-WP-TotalPages; 0 if header missing (caller should page until empty). */
  totalPages: number;
};

/**
 * One page of posts + WP REST total counts (for full-catalog sync without arbitrary caps).
 */
export async function getPostsPageWithHeaders(
  site: WPSite,
  page: number,
  perPage: number
): Promise<WPPostsPageHeaders> {
  const base = site.url.replace(/\/$/, "");
  const res = await fetch(
    wpRestUrl(base, `wp/v2/posts?per_page=${perPage}&page=${page}&_fields=id,title,link,slug,excerpt`),
    { headers: wpRestHeaders(site) }
  );
  if (res.status === 400) {
    return { posts: [], total: 0, totalPages: 0 };
  }
  if (!res.ok) throw new Error(`WP getPostsPage failed: ${res.status}`);
  const data = (await res.json()) as WPPostListItem[];
  const posts = Array.isArray(data) ? data : [];
  const total = parseInt(res.headers.get("x-wp-total") ?? "", 10);
  const totalPages = parseInt(res.headers.get("x-wp-totalpages") ?? "", 10);
  return {
    posts,
    total: Number.isFinite(total) ? total : 0,
    totalPages: Number.isFinite(totalPages) ? totalPages : 0,
  };
}

/** Paginated posts for building the internal link library (excerpt helps relevance). */
export async function getPostsPage(site: WPSite, page: number, perPage: number): Promise<WPPostListItem[]> {
  const { posts } = await getPostsPageWithHeaders(site, page, perPage);
  return posts;
}

const LINK_LIBRARY_PER_PAGE = 100;
const LINK_LIBRARY_MAX_PAGES_SAFETY = 500;

/**
 * All published posts visible to the REST user (up to 100 × 500 safety cap).
 * Uses X-WP-TotalPages when present; otherwise pages until an empty response (some CDNs strip headers).
 */
export async function fetchAllPostsForLinkLibrary(site: WPSite): Promise<WPPostListItem[]> {
  const perPage = LINK_LIBRARY_PER_PAGE;
  const first = await getPostsPageWithHeaders(site, 1, perPage);
  const all: WPPostListItem[] = [...first.posts];

  if (first.totalPages > 0) {
    const lastPage = Math.min(first.totalPages, LINK_LIBRARY_MAX_PAGES_SAFETY);
    for (let page = 2; page <= lastPage; page++) {
      const { posts } = await getPostsPageWithHeaders(site, page, perPage);
      if (posts.length === 0) break;
      all.push(...posts);
    }
  } else if (first.posts.length > 0) {
    for (let page = 2; page <= LINK_LIBRARY_MAX_PAGES_SAFETY; page++) {
      const { posts } = await getPostsPageWithHeaders(site, page, perPage);
      if (posts.length === 0) break;
      all.push(...posts);
    }
  }

  return all;
}

/** WooCommerce REST product row (wc/v3/products). */
export type WCProductListItem = {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  short_description?: string;
};

export type WCProductsPageHeaders = {
  products: WCProductListItem[];
  total: number;
  totalPages: number;
};

/**
 * One page of published WooCommerce products + total counts.
 * Uses Application Password auth (same as wp/v2); user needs permission to list products.
 */
export async function getProductsPageWithHeaders(
  site: WPSite,
  page: number,
  perPage: number
): Promise<WCProductsPageHeaders> {
  const base = site.url.replace(/\/$/, "");
  const res = await fetch(
    wpRestUrl(
      base,
      `wc/v3/products?per_page=${perPage}&page=${page}&status=publish&_fields=id,name,slug,permalink,short_description`
    ),
    { headers: wpRestHeaders(site) }
  );
  if (res.status === 404) {
    throw new Error(
      "WooCommerce REST not found (404). Install WooCommerce and ensure /wp-json/wc/v3 is available."
    );
  }
  if (res.status === 401 || res.status === 403) {
    const errText = await res.text();
    throw new Error(
      `WooCommerce products: ${res.status} — check that this WordPress user can access WooCommerce REST. ${errText.slice(0, 200)}`
    );
  }
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`WooCommerce getProductsPage failed: ${res.status} ${errText.slice(0, 400)}`);
  }
  const data = (await res.json()) as WCProductListItem[];
  const products = Array.isArray(data) ? data : [];
  const total = parseInt(res.headers.get("x-wp-total") ?? "", 10);
  const totalPages = parseInt(res.headers.get("x-wp-totalpages") ?? "", 10);
  return {
    products,
    total: Number.isFinite(total) ? total : 0,
    totalPages: Number.isFinite(totalPages) ? totalPages : 0,
  };
}

const PRODUCT_LINK_LIBRARY_PER_PAGE = 100;
const PRODUCT_LINK_LIBRARY_MAX_PAGES_SAFETY = 500;

/** All published products visible to the REST user (same paging pattern as posts). */
export async function fetchAllProductsForLinkLibrary(site: WPSite): Promise<WCProductListItem[]> {
  const perPage = PRODUCT_LINK_LIBRARY_PER_PAGE;
  const first = await getProductsPageWithHeaders(site, 1, perPage);
  const all: WCProductListItem[] = [...first.products];

  if (first.totalPages > 0) {
    const lastPage = Math.min(first.totalPages, PRODUCT_LINK_LIBRARY_MAX_PAGES_SAFETY);
    for (let page = 2; page <= lastPage; page++) {
      const { products } = await getProductsPageWithHeaders(site, page, perPage);
      if (products.length === 0) break;
      all.push(...products);
    }
  } else if (first.products.length > 0) {
    for (let page = 2; page <= PRODUCT_LINK_LIBRARY_MAX_PAGES_SAFETY; page++) {
      const { products } = await getProductsPageWithHeaders(site, page, perPage);
      if (products.length === 0) break;
      all.push(...products);
    }
  }

  return all;
}

export async function createPost(
  site: WPSite,
  title: string,
  content: string,
  featuredMediaId?: number,
  opts?: { categories?: number[]; tags?: number[] }
): Promise<{ id: number; link: string; editUrl: string; status: string }> {
  const base = site.url.replace(/\/$/, "");
  const body: Record<string, unknown> = {
    title,
    content,
    status: "draft",
  };
  if (featuredMediaId != null && featuredMediaId > 0) {
    body.featured_media = featuredMediaId;
  }
  if (Array.isArray(opts?.categories) && opts.categories.length > 0) {
    body.categories = opts.categories.filter((x) => Number.isFinite(x) && x > 0);
  }
  if (Array.isArray(opts?.tags) && opts.tags.length > 0) {
    body.tags = opts.tags.filter((x) => Number.isFinite(x) && x > 0);
  }

  const res = await fetch(wpRestUrl(base, "wp/v2/posts?context=edit"), {
    method: "POST",
    headers: wpRestHeaders(site, { contentTypeJson: true }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`WP createPost failed: ${res.status} ${errText}`);
  }
  const data = await res.json();
  const status = data.status ?? "draft";
  if (status !== "draft") {
    console.warn(`[createPost] WordPress returned status "${status}" instead of "draft"`);
  }
  return {
    id: data.id,
    link: data.link,
    editUrl: `${base}/wp-admin/post.php?post=${data.id}&action=edit`,
    status,
  };
}

export async function getCategoryIdByName(site: WPSite, categoryName: string): Promise<number | null> {
  const base = site.url.replace(/\/$/, "");
  const needle = categoryName.trim().toLowerCase();
  if (!needle) return null;

  const res = await fetch(
    wpRestUrl(
      base,
      `wp/v2/categories?per_page=100&search=${encodeURIComponent(categoryName)}&_fields=id,name,slug`
    ),
    { headers: wpRestHeaders(site) }
  );
  if (!res.ok) {
    const errText = await res.text();
    console.warn(`[getCategoryIdByName] ${res.status} ${errText}`);
    return null;
  }

  const rows = (await res.json()) as Array<{ id: number; name?: string; slug?: string }>;
  const exact =
    rows.find((r) => (r.name ?? "").trim().toLowerCase() === needle) ??
    rows.find((r) => (r.slug ?? "").trim().toLowerCase() === needle);
  return exact?.id ?? null;
}

/** Set featured image after post exists (more reliable than only passing featured_media on create). */
export async function setPostFeaturedMedia(site: WPSite, postId: number, mediaId: number): Promise<void> {
  if (!Number.isFinite(mediaId) || mediaId <= 0) return;
  const base = site.url.replace(/\/$/, "");
  const res = await fetch(wpRestUrl(base, `wp/v2/posts/${postId}`), {
    method: "POST",
    headers: wpRestHeaders(site, { contentTypeJson: true }),
    body: JSON.stringify({ featured_media: mediaId }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`WP setPostFeaturedMedia failed: ${res.status} ${errText}`);
  }
}

export async function uploadMedia(
  site: WPSite,
  imageBuffer: Buffer,
  filename: string,
  mimeType: string
): Promise<{ id: number; url: string }> {
  const base = (site.url ?? "").trim();
  const endpoint = wpRestUrl(base, "wp/v2/media");
  const fallbackBase = getWwwFallbackBase(base);
  const fallbackEndpoint = fallbackBase ? wpRestUrl(fallbackBase, "wp/v2/media") : null;

  const fetchErr = (e: unknown): string => {
    const msg = e instanceof Error ? e.message : String(e);
    const cause = e instanceof Error && e.cause ? String(e.cause) : "";
    return cause ? `${msg} | cause: ${cause}` : msg;
  };

  const tryMultipart = async (targetEndpoint: string): Promise<{ id: number; url: string }> => {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(imageBuffer)], { type: mimeType });
    formData.append("file", blob, filename);
    const res = await fetch(targetEndpoint, {
      method: "POST",
      headers: wpRestHeaders(site),
      body: formData,
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`WP uploadMedia (multipart) failed: ${res.status} ${errText}`);
    }
    const data = await res.json();
    return { id: data.id, url: data.source_url };
  };

  const tryRawBinary = async (targetEndpoint: string): Promise<{ id: number; url: string }> => {
    const headers = {
      ...wpRestHeaders(site),
      "Content-Type": mimeType,
      "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
    };
    const res = await fetch(targetEndpoint, {
      method: "POST",
      headers,
      body: new Uint8Array(imageBuffer),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`WP uploadMedia (raw) failed: ${res.status} ${errText}`);
    }
    const data = await res.json();
    return { id: data.id, url: data.source_url };
  };

  try {
    return await tryMultipart(endpoint);
  } catch (multipartErr) {
    console.warn(`[uploadMedia] multipart failed; retrying raw binary. ${fetchErr(multipartErr)}`);
  }

  try {
    return await tryRawBinary(endpoint);
  } catch (rawErr) {
    const rawMsg = fetchErr(rawErr);
    const dnsFail = /enotfound/i.test(rawMsg);
    if (dnsFail && fallbackEndpoint) {
      console.warn(`[uploadMedia] DNS failed for ${base}; retrying with www host.`);
      try {
        return await tryMultipart(fallbackEndpoint);
      } catch (w1) {
        console.warn(`[uploadMedia] www multipart failed; retrying raw. ${fetchErr(w1)}`);
      }
      try {
        return await tryRawBinary(fallbackEndpoint);
      } catch (w2) {
        throw new Error(
          `WP uploadMedia failed on both hostnames (${base} and ${fallbackBase}): ${fetchErr(w2)}`
        );
      }
    }
    throw new Error(`WP uploadMedia failed (multipart + raw): ${rawMsg}`);
  }
}

export async function updateMediaDetails(
  site: WPSite,
  mediaId: number,
  fields: { alt_text?: string; title?: string; caption?: string }
): Promise<void> {
  const base = site.url.replace(/\/$/, "");
  const body: Record<string, string> = {};
  if (fields.alt_text != null) body.alt_text = fields.alt_text;
  if (fields.title != null) body.title = fields.title;
  if (fields.caption != null) body.caption = fields.caption;
  if (Object.keys(body).length === 0) return;

  const res = await fetch(wpRestUrl(base, `wp/v2/media/${mediaId}`), {
    method: "POST",
    headers: wpRestHeaders(site, { contentTypeJson: true }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.warn(`[updateMediaDetails] ${res.status} ${errText}`);
  }
}

/** Yoast SEO post meta (requires Yoast registering these keys for REST; common on recent Yoast). */
export async function updatePostYoastMeta(
  site: WPSite,
  postId: number,
  fields: {
    metadesc?: string;
    focuskw?: string;
    /** SEO title override (_yoast_wpseo_title) */
    seoTitle?: string;
  }
): Promise<boolean> {
  const base = site.url.replace(/\/$/, "");
  const meta: Record<string, string> = {};
  if (fields.metadesc != null && fields.metadesc !== "") {
    meta._yoast_wpseo_metadesc = fields.metadesc.slice(0, 320);
  }
  if (fields.focuskw != null && fields.focuskw !== "") {
    meta._yoast_wpseo_focuskw = fields.focuskw.slice(0, 191);
  }
  if (fields.seoTitle != null && fields.seoTitle !== "") {
    meta._yoast_wpseo_title = fields.seoTitle.slice(0, 200);
  }
  if (Object.keys(meta).length === 0) return true;

  const res = await fetch(wpRestUrl(base, `wp/v2/posts/${postId}`), {
    method: "POST",
    headers: wpRestHeaders(site, { contentTypeJson: true }),
    body: JSON.stringify({ meta }),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.warn(`[updatePostYoastMeta] ${res.status} ${errText}`);
    return false;
  }
  return true;
}

/** Rank Math SEO post meta (requires Rank Math meta to be writable via REST on the site). */
export async function updatePostRankMathMeta(
  site: WPSite,
  postId: number,
  fields: {
    metadesc?: string;
    focuskw?: string;
    seoTitle?: string;
  }
): Promise<boolean> {
  const base = site.url.replace(/\/$/, "");
  const meta: Record<string, string> = {};
  if (fields.metadesc != null && fields.metadesc !== "") {
    meta.rank_math_description = fields.metadesc.slice(0, 320);
  }
  if (fields.focuskw != null && fields.focuskw !== "") {
    meta.rank_math_focus_keyword = fields.focuskw.slice(0, 191);
  }
  if (fields.seoTitle != null && fields.seoTitle !== "") {
    meta.rank_math_title = fields.seoTitle.slice(0, 200);
  }
  if (Object.keys(meta).length === 0) return true;
  const payloads: Array<Record<string, unknown>> = [
    // Standard REST meta payload (works when keys are registered with show_in_rest).
    { meta },
    // Some installs/plugins honor meta_input in REST update.
    { meta_input: meta },
    // Fallback for sites/plugins that map top-level keys.
    {
      rank_math_title: meta.rank_math_title,
      rank_math_description: meta.rank_math_description,
      rank_math_focus_keyword: meta.rank_math_focus_keyword,
    },
  ];

  for (let i = 0; i < payloads.length; i++) {
    const res = await fetch(wpRestUrl(base, `wp/v2/posts/${postId}`), {
      method: "POST",
      headers: wpRestHeaders(site, { contentTypeJson: true }),
      body: JSON.stringify(payloads[i]),
    });
    if (res.ok) return true;
    const errText = await res.text();
    console.warn(`[updatePostRankMathMeta] attempt ${i + 1} failed: ${res.status} ${errText}`);
  }

  console.warn(
    "[updatePostRankMathMeta] Rank Math fields not persisted. Ensure rank_math_* meta keys are registered for REST on this WordPress site."
  );
  return false;
}
