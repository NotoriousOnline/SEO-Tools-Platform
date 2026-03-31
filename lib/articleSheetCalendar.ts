/** Shared types + parsing for the Weed.com Learn Articles Google Sheet (no server-only imports). */

export type ArticleSheetRow = {
  /** 1-based row number in the spreadsheet (for display). */
  sheetRow: number;
  id: string;
  batch: string;
  cluster: string;
  experience: string;
  productType: string;
  articleTitle: string;
  contentAngle: string;
  targetKeyword: string;
  priority: string;
  notes: string;
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

function findCol(header: string[], ...candidates: string[]): number {
  const H = header.map(normalizeHeader);
  for (const c of candidates) {
    const n = normalizeHeader(c);
    const i = H.indexOf(n);
    if (i >= 0) return i;
  }
  return -1;
}

/**
 * Map header row + data rows to structured objects. Skips rows with no article title.
 * Fallback column order: ID, Batch, Cluster, Experience, Product Type, Article Title, Content Angle, Target Keyword, Priority, Notes.
 */
export function parseArticleSheetRows(values: string[][]): ArticleSheetRow[] {
  if (!values.length) return [];
  const header = values[0].map((c) => (c ?? "").trim());
  const col = {
    id: findCol(header, "id"),
    batch: findCol(header, "batch"),
    cluster: findCol(header, "cluster"),
    experience: findCol(header, "experience"),
    productType: findCol(header, "product type", "producttype"),
    articleTitle: findCol(header, "article title", "articletitle"),
    contentAngle: findCol(header, "content angle", "contentangle"),
    targetKeyword: findCol(header, "target keyword", "targetkeyword"),
    priority: findCol(header, "priority"),
    notes: findCol(header, "notes"),
  };

  const pick = (row: string[], key: keyof typeof col, fallbackIndex: number): string => {
    const i = col[key] >= 0 ? col[key] : fallbackIndex;
    return (row[i] ?? "").trim();
  };

  const out: ArticleSheetRow[] = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r] ?? [];
    const articleTitle = pick(row, "articleTitle", 5);
    if (!articleTitle) continue;
    out.push({
      sheetRow: r + 1,
      id: pick(row, "id", 0),
      batch: pick(row, "batch", 1),
      cluster: pick(row, "cluster", 2),
      experience: pick(row, "experience", 3),
      productType: pick(row, "productType", 4),
      articleTitle,
      contentAngle: pick(row, "contentAngle", 6),
      targetKeyword: pick(row, "targetKeyword", 7),
      priority: pick(row, "priority", 8),
      notes: pick(row, "notes", 9),
    });
  }
  return out;
}

export function targetKeywordToKeywords(s: string): string[] {
  return s
    .split(/[,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function buildEditorialBriefFromRow(row: ArticleSheetRow): string {
  const lines = [
    "Content calendar brief (follow this editorial direction and cluster):",
    `- Batch: ${row.batch}`,
    `- Cluster: ${row.cluster}`,
    `- Experience: ${row.experience}`,
    `- Product type: ${row.productType}`,
    `- Content angle: ${row.contentAngle}`,
    `- Priority: ${row.priority}`,
  ];
  if (row.notes.trim()) lines.push(`- Notes: ${row.notes.trim()}`);
  return lines.join("\n");
}
