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
  const trimmedBase = base.replace(/\/$/, "");
  const path = restPathAndQuery.replace(/^\//, "");
  const url = `${trimmedBase}/wp-json/${path}`;
  const bypass = (process.env.WORDPRESS_WAF_BYPASS_QUERY ?? "").trim();
  if (!bypass) return url;
  return url.includes("?") ? `${url}&${bypass}` : `${url}?${bypass}`;
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

export async function createPost(
  site: WPSite,
  title: string,
  content: string,
  featuredMediaId?: number
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
  const base = site.url.replace(/\/$/, "");
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(imageBuffer)], { type: mimeType });
  formData.append("file", blob, filename);

  const res = await fetch(wpRestUrl(base, "wp/v2/media"), {
    method: "POST",
    headers: wpRestHeaders(site),
    body: formData,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`WP uploadMedia failed: ${res.status} ${errText}`);
  }
  const data = await res.json();
  return { id: data.id, url: data.source_url };
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
