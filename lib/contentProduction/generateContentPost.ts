import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { errorMessage, serverLog } from "@/lib/serverLog";
import { stripLeadingPostTitleH1 } from "@/lib/postHtml";
import { getSiteById, WP_TOOL_SCOPE, type WPToolScope } from "@/lib/wpSites";
import { getPosts } from "@/lib/wordpressClient";

type Post = { id: number; title: { rendered: string }; link: string; slug: string };

function scoreRelevance(post: Post, keywords: string[]): number {
  const text = `${(post.title?.rendered ?? "").toLowerCase()} ${(post.slug ?? "").toLowerCase()}`;
  let score = 0;
  for (const kw of keywords) {
    if (!kw) continue;
    const lower = kw.toLowerCase();
    if (text.includes(lower)) score += 2;
    const words = text.split(/\s+/);
    const kwWords = lower.split(/\s+/);
    for (const kwWord of kwWords) {
      if (words.some((w) => w.includes(kwWord) || kwWord.includes(w))) score += 1;
    }
  }
  return score;
}

function pickRelevantPosts(posts: Post[], keywords: string[], count: number): Post[] {
  if (posts.length === 0) return [];
  const scored = posts.map((p) => ({ post: p, score: scoreRelevance(p, keywords) }));
  scored.sort((a, b) => b.score - a.score);
  const top = scored.filter((s) => s.score > 0).slice(0, count);
  if (top.length === 0) return posts.slice(0, count);
  return top.map((s) => s.post);
}

function replaceEmDashes(html: string): string {
  return html.replace(/\u2014/g, " - ").replace(/\u2013/g, "-");
}

function stripHtmlCodeFences(text: string): string {
  let s = text.trim();
  if (s.startsWith("```")) {
    const nl = s.indexOf("\n");
    if (nl !== -1) {
      s = s.slice(nl + 1);
    } else {
      s = s.replace(/^```\w*\s*/, "");
    }
  }
  s = s.trimEnd();
  if (s.endsWith("```")) {
    s = s.slice(0, s.lastIndexOf("```")).trimEnd();
  }
  return s.trim();
}

function brandAddendumForScope(toolScope: WPToolScope): string {
  if (toolScope === WP_TOOL_SCOPE.weedComContentProduction) {
    return `

Weed.com editorial context: Audience is adults seeking cannabis education and culture content. Use a credible, approachable editorial voice. Where law, health, or dosage appear, stay informational and avoid medical claims; laws vary by jurisdiction—encourage readers to verify local rules. No marketing to minors. Align imagery-related sections with brand-safe, non-explicit phrasing.`;
  }
  return "";
}

export async function postGenerateContent(request: Request, toolScope: WPToolScope) {
  try {
    const body = await request.json();
    const { siteId, title, keywords, wordCount } = body;

    if (!siteId || !title || !Array.isArray(keywords) || typeof wordCount !== "number") {
      return NextResponse.json(
        { error: "Missing or invalid fields: siteId, title, keywords (array), wordCount (number)" },
        { status: 400 }
      );
    }

    const site = await getSiteById(siteId, toolScope);
    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const posts = await getPosts(site, 50);
    const relevantPosts = pickRelevantPosts(posts, keywords, 3);
    const internalLinks = relevantPosts.map((p) => ({
      title: p.title?.rendered ?? p.slug ?? "Untitled",
      url: p.link,
    }));

    const tonePrompt = site.tone_prompt ?? "Write in a clear, authoritative, and engaging editorial tone.";
    const systemPrompt = `${tonePrompt}
${brandAddendumForScope(toolScope)}

You are an expert SEO content writer. Write a complete blog post in valid HTML (not markdown).
Never wrap the output in code fences: do not use triple backticks, do not write \`\`\`html or \`\`\` before or after the HTML. Return raw HTML only.
Do NOT put the article title in the body: no <h1> and no title heading. The CMS sets the post title separately.
Start the body with an introduction using <p>, or the first <h2> section heading. Use <h2> and <h3> only inside the article. Target ${wordCount} words. Naturally embed 2-3 internal links
from the provided list using contextually appropriate anchor text. Do not add external links.

Typography: Never use the em dash character (Unicode U+2014). Do not type "—". Use commas,
semicolons, parentheses, or a spaced hyphen " - " instead when you need a pause or aside.

Structure: Near the end, include FAQs before any brief closing paragraph:
- One <h2> for the FAQ block (e.g. "Frequently asked questions" or a topic-specific label).
- Either ONE set of questions (each question is an <h3>, answer in <p> and/or <ul><li> bullets
  when several points apply), OR TWO thematic <h3> subsections when the topic clearly splits
  (e.g. overview vs. practical steps); under each <h3> subsection use <h4> for each question.
- Use bullet lists where answers have multiple distinct facts or steps; use prose where one
  short paragraph is enough.
- 4 to 8 Q&A pairs total, all on-topic for the title and keywords.`;

    const linksText = internalLinks
      .map((l) => `- ${l.title}: ${l.url}`)
      .join("\n");
    const userMessage = `Title: ${title}

Keywords: ${keywords.join(", ")}

Internal link candidates (use 2-3 of these):
${linksText}

Write the full HTML blog post. Include the FAQ block as specified (1 or 2 FAQ subsections by topic fit, bullets in answers where it helps). Remember: no em dash character anywhere in the HTML. Do not output an <h1>; the post title is set only in WordPress. Start with <p> or <h2>.`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: Math.max(4096, Math.ceil(wordCount * 2.5)),
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const firstBlock = response.content[0];
    const raw = firstBlock?.type === "text" ? firstBlock.text : "";
    const content = stripLeadingPostTitleH1(replaceEmDashes(stripHtmlCodeFences(raw)));

    const used: { title: string; url: string }[] = [];
    for (const link of internalLinks) {
      if (content.includes(link.url)) {
        used.push(link);
      }
    }

    const wordCountActual = content.split(/\s+/).filter(Boolean).length;

    return NextResponse.json({
      content,
      internalLinksUsed: used,
      wordCount: wordCountActual,
    });
  } catch (err) {
    const msg = errorMessage(err);
    console.error("[generate-content] Error:", msg);
    void serverLog({ level: "error", source: "content-production/generate-content", message: msg });
    return NextResponse.json(
      { error: msg || "Failed to generate content" },
      { status: 500 }
    );
  }
}
