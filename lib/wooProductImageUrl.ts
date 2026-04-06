/**
 * WooCommerce REST often returns image.src as protocol-relative (//cdn...) or path-only (/wp-content/...).
 * Published HTML needs absolute https URLs so thumbnails load on the live site and in all contexts.
 */
export function resolveWooCommerceProductImageUrl(
  src: string | undefined | null,
  productPermalink: string | undefined | null,
  siteBaseUrl?: string | undefined | null
): string | null {
  let raw = typeof src === "string" ? src.trim() : "";
  if (!raw) return null;

  if (raw.startsWith("//")) {
    raw = `https:${raw}`;
  }

  if (/^https?:\/\//i.test(raw)) {
    try {
      const imgUrl = new URL(raw);
      const perm = (productPermalink ?? "").trim();
      if (perm.startsWith("https://")) {
        const pUrl = new URL(perm);
        if (imgUrl.hostname === pUrl.hostname && imgUrl.protocol === "http:") {
          imgUrl.protocol = "https:";
          return imgUrl.href;
        }
      }
      return raw;
    } catch {
      return raw;
    }
  }

  const baseStr = (productPermalink ?? "").trim() || (siteBaseUrl ?? "").trim();
  if (!baseStr) return null;

  const normalizedBase = /^https?:\/\//i.test(baseStr) ? baseStr : `https://${baseStr.replace(/^\/\//, "")}`;

  try {
    const originUrl = new URL(normalizedBase);
    const path = raw.startsWith("/") ? raw : `/${raw}`;
    const out = new URL(path, originUrl.origin);
    if (out.protocol === "http:") out.protocol = "https:";
    return out.href;
  } catch {
    return null;
  }
}
