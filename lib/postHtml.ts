/** WordPress post title is stored separately; remove duplicate title heading from body HTML. */
export function stripLeadingPostTitleH1(html: string): string {
  return html.trim().replace(/^<h1\b[^>]*>[\s\S]*?<\/h1>\s*/i, "").trim();
}
