import { NextResponse } from "next/server";
import sharp from "sharp";
import { getSiteById, type WPToolScope } from "@/lib/wpSites";
import { stripLeadingPostTitleH1 } from "@/lib/postHtml";
import {
  createPost,
  setPostFeaturedMedia,
  uploadMedia,
  updateMediaDetails,
  updatePostYoastMeta,
} from "@/lib/wordpressClient";

const MAX_IMAGE_DIMENSION = 1200;
const JPEG_QUALITY = 85;

async function compressImageForUpload(
  buffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; mimeType: string; ext: string }> {
  try {
    const pipeline = sharp(buffer)
      .resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, { fit: "inside", withoutEnlargement: true });

    const out = await pipeline
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();
    return { buffer: out, mimeType: "image/jpeg", ext: "jpg" };
  } catch {
    return {
      buffer,
      mimeType: mimeType ?? "image/png",
      ext: mimeType?.includes("jpeg") || mimeType?.includes("jpg") ? "jpg" : "png",
    };
  }
}

type ImageItem = {
  type: "featured" | "in-content";
  index: number;
  base64: string;
  mimeType: string;
  prompt?: string;
  altText?: string;
  fileSlug?: string;
  h2Index?: number;
};

function findH2EndPositionByIndex(html: string, h2Index: number): number | null {
  const regex = /<h2[^>]*>[\s\S]*?<\/h2>/gi;
  let match;
  let i = 0;
  while ((match = regex.exec(html)) !== null) {
    if (i === h2Index) return match.index + match[0].length;
    i++;
  }
  return null;
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

type InContentPlacement = { url: string; alt: string; h2Index: number; order: number };

function injectInContentImages(html: string, placements: InContentPlacement[]): string {
  if (placements.length === 0) return html;

  const insertions: { pos: number; order: number; html: string }[] = [];
  for (const p of placements) {
    const pos = findH2EndPositionByIndex(html, p.h2Index);
    if (pos == null) continue;
    const imgHtml = `<figure class="wp-block-image"><img src="${escapeHtmlAttr(p.url)}" alt="${escapeHtmlAttr(p.alt)}" /></figure>`;
    insertions.push({ pos, order: p.order, html: imgHtml });
  }

  insertions.sort((a, b) => {
    if (a.pos !== b.pos) return b.pos - a.pos;
    return b.order - a.order;
  });

  let result = html;
  for (const ins of insertions) {
    result = result.slice(0, ins.pos) + ins.html + result.slice(ins.pos);
  }
  return result;
}

function buildMetaDescription(html: string, maxLen = 156): string {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen - 3);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}...`;
}

function pickFocusKeyphrase(keywords: unknown, title: string): string {
  if (Array.isArray(keywords)) {
    const k = keywords.map((x) => String(x).trim()).find((x) => x.length > 0);
    if (k && k.length <= 191) return k;
  }
  return title.slice(0, 80).trim();
}

function appendReferenceDisclaimer(html: string, referenceUrlRaw: unknown): string {
  if (typeof referenceUrlRaw !== "string") return html;
  const raw = referenceUrlRaw.trim();
  if (!raw) return html;
  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return html;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return html;
  const href = parsed.href;
  const escAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const escText = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const footer = `<p><em>This article is for informational purposes only.</em></p><p>Reference: <a href="${escAttr(href)}" target="_blank" rel="nofollow noopener noreferrer">${escText(href)}</a></p>`;
  return `${html.trimEnd()}\n\n${footer}`;
}

export async function postPublish(request: Request, toolScope: WPToolScope) {
  try {
    const body = await request.json();
    const { siteId, title, content, images, referenceUrl, keywords } = body;

    if (!siteId || !title || !content || !Array.isArray(images)) {
      return NextResponse.json(
        { error: "Missing or invalid fields: siteId, title, content, images (array)" },
        { status: 400 }
      );
    }

    const site = await getSiteById(siteId, toolScope);
    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const imageItems = images as ImageItem[];
    const featuredImg = imageItems.find((i) => i.type === "featured");
    const inContentImgs = imageItems
      .filter((i) => i.type === "in-content")
      .sort((a, b) => a.index - b.index);

    let featuredMediaId: number | undefined;

    if (featuredImg?.base64) {
      const buf = Buffer.from(featuredImg.base64, "base64");
      const { buffer, mimeType, ext } = await compressImageForUpload(buf, featuredImg.mimeType ?? "image/png");
      const slug = (featuredImg.fileSlug ?? "featured").replace(/[^a-z0-9-]/gi, "-").slice(0, 60);
      const { id } = await uploadMedia(site, buffer, `${slug}.${ext}`, mimeType);
      featuredMediaId = id;
      await updateMediaDetails(site, id, {
        alt_text: featuredImg.altText ?? title.slice(0, 125),
        title: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      });
    }

    const placements: InContentPlacement[] = [];
    let order = 0;
    for (const img of inContentImgs) {
      if (!img.base64) continue;
      const buf = Buffer.from(img.base64, "base64");
      const { buffer, mimeType, ext } = await compressImageForUpload(buf, img.mimeType ?? "image/png");
      const slug =
        (img.fileSlug ?? `in-content-${img.index}`).replace(/[^a-z0-9-]/gi, "-").slice(0, 60) || `in-content-${img.index}`;
      const { id, url } = await uploadMedia(site, buffer, `${slug}.${ext}`, mimeType);
      await updateMediaDetails(site, id, {
        alt_text: img.altText ?? `Illustration for section ${img.index}`,
        title: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      });
      const h2Index = typeof img.h2Index === "number" ? img.h2Index : img.index - 1;
      placements.push({
        url,
        alt: img.altText ?? "Article illustration",
        h2Index: Math.max(0, h2Index),
        order: order++,
      });
    }

    const bodyHtml = stripLeadingPostTitleH1(typeof content === "string" ? content : "");
    const withImages = injectInContentImages(bodyHtml, placements);
    const finalContent = appendReferenceDisclaimer(withImages, referenceUrl);
    const { id: postId, link, editUrl, status } = await createPost(site, title, finalContent);
    if (featuredMediaId != null && featuredMediaId > 0) {
      await setPostFeaturedMedia(site, postId, featuredMediaId);
    }

    const metadesc = buildMetaDescription(finalContent);
    const focuskw = pickFocusKeyphrase(keywords, title);
    const yoastOk = await updatePostYoastMeta(site, postId, {
      metadesc,
      focuskw,
      seoTitle: title.slice(0, 200),
    });

    if (status !== "draft") {
      console.warn(`[publish] WordPress created post with status "${status}" (expected "draft")`);
    }

    return NextResponse.json({
      postId,
      postUrl: link,
      editUrl,
      status,
      site: { name: site.name, url: site.url },
      yoast: { metaDescriptionSet: yoastOk, focusKeyphrase: focuskw },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[publish] Error:", msg);
    return NextResponse.json(
      { error: msg || "Failed to publish" },
      { status: 500 }
    );
  }
}
