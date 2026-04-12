import type { TabibiPmidEntry } from "@/lib/tabibiPmidDatabase";
import { formatTabibiCitationLine } from "@/lib/tabibiPmidDatabase";

/** User asked for max 3 or 4 sources; we cap at 4. */
export const TABIBI_SOURCES_FOOTER_MAX = 4;

const BLOCK_START = "<!-- tabibi-sources-footer:start -->";
const BLOCK_END = "<!-- tabibi-sources-footer:end -->";

const PUBMED_RE = /https?:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)\/?/gi;

function stripPreviousFooter(html: string): string {
  let s = html;
  for (;;) {
    const start = s.indexOf(BLOCK_START);
    if (start === -1) break;
    const end = s.indexOf(BLOCK_END, start);
    if (end === -1) break;
    s = (s.slice(0, start) + s.slice(end + BLOCK_END.length)).replace(/\n{3,}/g, "\n\n");
  }
  return s;
}

/** PubMed PMIDs in first-seen order (digits as strings). */
export function extractPubmedPmidsFromHtml(html: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(PUBMED_RE.source, "gi");
  while ((m = re.exec(html)) !== null) {
    const id = m[1];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function escapeHtmlText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Bible Sources outer opening tag (no font-size on this div — legal footer uses font-size on its outer div). */
const BIBLE_SOURCES_OUTER_OPEN =
  '<div style="margin:2rem 0 0;padding:0;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;">';

function findMatchingOuterCloseDiv(html: string, openTagStart: number): number {
  const gt = html.indexOf(">", openTagStart);
  if (gt === -1) return -1;
  let depth = 1;
  let i = gt + 1;
  const lower = html.toLowerCase();
  while (i < html.length) {
    const nextOpen = lower.indexOf("<div", i);
    const nextClose = lower.indexOf("</div>", i);
    if (nextClose === -1) return -1;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      i = nextOpen + 4;
    } else {
      depth--;
      const end = nextClose + 6;
      if (depth === 0) return end;
      i = end;
    }
  }
  return -1;
}

/**
 * Picks up to `max` entries from `ranked` (most relevant first):
 * - Prefer PMIDs that appear in the HTML as PubMed links, in ranked order.
 * - Pad with the next ranked entries until `max` (or list ends).
 */
export function pickTabibiSourcesForFooter(
  html: string,
  ranked: TabibiPmidEntry[],
  max: number = TABIBI_SOURCES_FOOTER_MAX
): TabibiPmidEntry[] {
  if (ranked.length === 0) return [];
  const maxN = Math.min(max, ranked.length);
  const inArticle = new Set(extractPubmedPmidsFromHtml(html));
  const out: TabibiPmidEntry[] = [];
  const seen = new Set<string>();

  for (const e of ranked) {
    if (out.length >= maxN) break;
    if (inArticle.has(e.pmid) && !seen.has(e.pmid)) {
      seen.add(e.pmid);
      out.push(e);
    }
  }
  for (const e of ranked) {
    if (out.length >= maxN) break;
    if (!seen.has(e.pmid)) {
      seen.add(e.pmid);
      out.push(e);
    }
  }
  return out;
}

/** Bible Sources outer wrapper + lines (Inter stack). */
export function buildTabibiSourcesFooterHtml(entries: TabibiPmidEntry[]): string {
  if (entries.length === 0) return "";
  const outerOpen = `<div style="margin:2rem 0 0;padding:0;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">`;
  const titleRow = `<div style="font-size:1rem;font-weight:400;color:#334155;margin:0 0 0.85rem;line-height:1.4;">Sources</div>`;
  const lines = entries.map((e) => {
    const citeText = formatTabibiCitationLine(e);
    const href = `https://pubmed.ncbi.nlm.nih.gov/${e.pmid}/`;
    return `<div style="font-size:1rem;font-weight:400;color:#334155;line-height:1.55;margin:0 0 0.65rem;">${escapeHtmlText(citeText)} <a href="${href}" style="color:#0f766e;text-decoration:underline;">PMID: ${e.pmid}</a></div>`;
  });
  return `${BLOCK_START}\n${outerOpen}\n${titleRow}\n${lines.join("\n")}\n</div>\n${BLOCK_END}`;
}

function findLegalFooterInsertIndex(html: string): number {
  const marker = "For adults 21+ only";
  const idx = html.indexOf(marker);
  if (idx === -1) return -1;
  const re = /<p\b[^>]*>\s*For adults 21\+ only/gi;
  let last = -1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m.index <= idx) last = m.index;
  }
  if (last !== -1) return last;
  const reDiv = /<div\b[^>]*>\s*<p\b[^>]*>\s*For adults 21\+ only/gi;
  while ((m = reDiv.exec(html)) !== null) {
    if (m.index <= idx) last = m.index;
  }
  return last;
}

/**
 * Strips any prior injected Tabibi Sources block, removes a duplicate model "Sources" section
 * when it matches the Bible pattern immediately before the legal footer, then inserts the new block.
 */
export function appendTabibiSourcesFooter(html: string, ranked: TabibiPmidEntry[]): string {
  let cleaned = stripPreviousFooter(html).trimEnd();
  const picked = pickTabibiSourcesForFooter(cleaned, ranked, TABIBI_SOURCES_FOOTER_MAX);
  if (picked.length === 0) return cleaned;

  const blockHtml = "\n" + buildTabibiSourcesFooterHtml(picked) + "\n";
  cleaned = stripModelSourcesBeforeLegalIfPresent(cleaned);
  const insertAt = findLegalFooterInsertIndex(cleaned);
  if (insertAt === -1) {
    return cleaned + blockHtml;
  }
  return cleaned.slice(0, insertAt) + blockHtml + cleaned.slice(insertAt);
}

/**
 * Removes one Bible-style Sources wrapper (outer div + "Sources" heading + citation lines)
 * before the legal footer so we do not show Sources twice after appending the JSON-driven block.
 */
function stripModelSourcesBeforeLegalIfPresent(html: string): string {
  const marker = "For adults 21+ only";
  const legalIdx = html.indexOf(marker);
  if (legalIdx === -1) return html;
  const head = html.slice(0, legalIdx);
  const titleIdx = head.lastIndexOf(">Sources</div>");
  if (titleIdx === -1) return html;
  const openIdx = head.lastIndexOf(BIBLE_SOURCES_OUTER_OPEN, titleIdx);
  if (openIdx === -1) return html;
  const endOuter = findMatchingOuterCloseDiv(html, openIdx);
  if (endOuter === -1 || endOuter > legalIdx) return html;
  return html.slice(0, openIdx) + html.slice(endOuter);
}
