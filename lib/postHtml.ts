/** WordPress post title is stored separately; remove duplicate title heading from body HTML. */
export function stripLeadingPostTitleH1(html: string): string {
  return html.trim().replace(/^<h1\b[^>]*>[\s\S]*?<\/h1>\s*/i, "").trim();
}

const EXPERT_BOX_INTER_LOCK = "font-family:Inter,sans-serif!important";

const VOID_HTML_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

const SKIP_FONT_LOCK_TAGS = new Set(["script", "style", "noscript", "textarea", "title"]);

function cleanStyleAfterFontStrip(styles: string): string {
  return styles
    .replace(/font-family\s*:\s*[^;]+;?/gi, "")
    .replace(/\bfont\s*:\s*[^;]+;?/gi, "")
    .replace(/mso-(?:ascii|bidi|fareast|hansi)-font-family\s*:\s*[^;]+;?/gi, "")
    .replace(/;+/g, ";")
    .replace(/^\s*;\s*|\s*;\s*$/g, "")
    .trim();
}

function stripFontDeclarationsFromInlineStyles(fragment: string): string {
  let s = fragment.replace(/\sstyle\s*=\s*"([^"]*)"/gi, (_m, styles: string) => {
    const cleaned = cleanStyleAfterFontStrip(styles);
    return cleaned ? ` style="${cleaned}"` : "";
  });
  s = s.replace(/\sstyle\s*=\s*'([^']*)'/gi, (_m, styles: string) => {
    const cleaned = cleanStyleAfterFontStrip(styles);
    return cleaned ? ` style='${cleaned}'` : "";
  });
  return s;
}

function hasInterSansLock(styleValue: string): boolean {
  return /font-family\s*:\s*Inter\s*,\s*sans-serif\s*!\s*important/i.test(styleValue);
}

/** Adds Inter !important to every non-void opening tag inside the fragment (Expert Insight subtree). */
function appendInterFontLockToOpeningTags(fragment: string): string {
  return fragment.replace(
    /<(\/?)([a-zA-Z][a-zA-Z0-9:.-]*)(\s[^>]*)?>/g,
    (full, slash: string, tagName: string, rest?: string) => {
      if (slash) return full;
      const local = tagName.includes(":") ? tagName.replace(/^.*:/, "") : tagName;
      const t = local.toLowerCase();
      if (VOID_HTML_TAGS.has(t) || SKIP_FONT_LOCK_TAGS.has(t)) return full;
      const attrs = rest ?? "";
      const styleRe = /\bstyle\s*=\s*(["'])((?:(?!\1).)*)\1/i;
      const sm = styleRe.exec(attrs);
      if (sm) {
        const q = sm[1];
        let v = sm[2].trim();
        if (hasInterSansLock(v)) return full;
        v = v.replace(/;+\s*$/, "").trim();
        const nv = v ? `${v};${EXPERT_BOX_INTER_LOCK}` : EXPERT_BOX_INTER_LOCK;
        const newAttrs = attrs.replace(styleRe, `style=${q}${nv}${q}`);
        return `<${tagName}${newAttrs}>`;
      }
      return `<${tagName}${attrs} style="${EXPERT_BOX_INTER_LOCK}">`;
    }
  );
}

function findExpertBoxBlockEnd(html: string, contentStart: number): number {
  let depth = 1;
  let searchPos = contentStart;
  while (depth > 0 && searchPos < html.length) {
    const slice = html.slice(searchPos);
    const lower = slice.toLowerCase();
    const relOpen = lower.indexOf("<div");
    const relClose = lower.indexOf("</div");
    const divOpen = relOpen === -1 ? -1 : searchPos + relOpen;
    const divClose = relClose === -1 ? -1 : searchPos + relClose;
    if (divClose === -1) return html.length;
    if (divOpen !== -1 && divOpen < divClose) {
      depth++;
      searchPos = divOpen + 4;
    } else {
      depth--;
      const gt = html.indexOf(">", divClose);
      searchPos = gt === -1 ? html.length : gt + 1;
    }
  }
  return searchPos;
}

function sanitizeExpertBoxBlock(block: string): string {
  const stripped = stripFontDeclarationsFromInlineStyles(block);
  return appendInterFontLockToOpeningTags(stripped);
}

/**
 * Locks Dr. Tabibi Expert Insight (`.expert-box`) to Inter: strips pasted/theme font-family and
 * `font` shorthand from inline styles inside each block, then adds `font-family:Inter,sans-serif!important`
 * on every opening tag so inheritance and specificity beat copy-paste from Word and most theme rules.
 */
export function lockExpertBoxTypography(html: string): string {
  if (!html.includes("expert-box")) return html;
  let out = "";
  let cursor = 0;
  while (cursor < html.length) {
    const divIdx = html.toLowerCase().indexOf("<div", cursor);
    if (divIdx === -1) {
      out += html.slice(cursor);
      break;
    }
    const gt = html.indexOf(">", divIdx);
    if (gt === -1) {
      out += html.slice(cursor);
      break;
    }
    const openTag = html.slice(divIdx, gt + 1);
    if (!/\bclass\s*=\s*["'][^"']*\bexpert-box\b/.test(openTag)) {
      out += html.slice(cursor, gt + 1);
      cursor = gt + 1;
      continue;
    }
    out += html.slice(cursor, divIdx);
    const blockEnd = findExpertBoxBlockEnd(html, gt + 1);
    const rawBlock = html.slice(divIdx, blockEnd);
    out += sanitizeExpertBoxBlock(rawBlock);
    cursor = blockEnd;
  }
  return out;
}
