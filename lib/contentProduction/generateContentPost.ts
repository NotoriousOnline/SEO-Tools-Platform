import { NextResponse } from "next/server";
import { callClaude, isClaudeServiceUnavailableError } from "@/lib/anthropic";
import { errorMessage, serverLog } from "@/lib/serverLog";
import { stripLeadingPostTitleH1 } from "@/lib/postHtml";
import { getCandidatesFromLibrary, pickCandidatesFromLivePosts } from "@/lib/siteLinkLibrary";
import { getSiteById, WP_TOOL_SCOPE, type WPToolScope } from "@/lib/wpSites";
import { getPosts } from "@/lib/wordpressClient";

/** Richer pool for the model + Supabase library when synced. */
const INTERNAL_LINK_CANDIDATES_FOR_PROMPT = 14;
const LIBRARY_USE_MIN = 3;

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

Weed.com editorial context: Audience is adults seeking cannabis education and culture content. Use a credible, approachable editorial voice. Where law, health, or dosage appear, stay informational and avoid medical claims; laws vary by jurisdiction - encourage readers to verify local rules. No marketing to minors. Align imagery-related sections with brand-safe, non-explicit phrasing.

Internal linking (editorial / Bible-style): Anchor text must be deliberate and descriptive. The reader should understand what they are navigating to before they click. Do not use vague anchors such as "this guide," "this breakdown," "this piece," "this article," "read more," "click here," or "learn more" unless immediately paired with clear topic words (prefer: drop those phrases entirely). Base anchors on the destination's subject matter; you may compress a long title but must keep the meaning. Match phrasing to the surrounding sentence so links feel earned, not bolted on.

Product mentions and editorial commerce: When citing a specific product or brand from the internal link list, weave it into the section's argument. Briefly set up why the example matters (reader goal, comparison, formulation type, use case) before the name or link. Avoid abrupt one-line product drops that read like affiliate widgets or interrupt a science/education block without transition. Prefer framing such as how readers weigh options in that category, then name the product as one concrete example. Stay factual; no unsubstantiated superiority claims.`;
  }
  return "";
}

function weedLayer1BiblePrompt(toolScope: WPToolScope): string {
  if (toolScope !== WP_TOOL_SCOPE.weedComContentProduction) return "";
  return `

WEED.COM CONTENT GENERATION PROMPT - LAYER 1 (AI DRAFT)
Version: Bible v5 | March 2026
This is Layer 1 only and must be edited by a human expert before publish.

SYSTEM ROLE
You are a professional cannabis content writer producing Layer 1 first drafts for Weed.com Learn.
Follow Bible v5 strictly. Drafts are structured, evidence-referenced, and brief-compliant.

MANDATORY RULES
- Voice: knowledgeable, warm, direct, never condescending, never hype/fear, honest on evidence limits.
- Use second person ("you") throughout.
- No em dash character.
- Intro must open with a real tension/question, no generic scene-setting.
- Keyword placement: do not stuff or force the primary target keyword at the very start of the first paragraph, and do not place it inside any heading (<h2>, <h3>, <h4>). Use natural wording; the topic may appear later in body copy where it reads normally.
- Paragraphs max 4 sentences, one idea per paragraph.
- Use bullets only for true lists.
- No disease-treatment claims.
- No specific drug interaction advice.
- Include this language in appropriate sections: "If you take prescription medications, speak with your pharmacist or physician before using CBD/cannabis products."
- For mental health/sleep/pain risk contexts, include: "If you are experiencing a medical emergency, call 911 or go to your nearest emergency room."

DR. ALEX / EXPERT NOTE BOX (required for every placeholder)
Each [DR. AUTHOR VOICE - ...] block must be wrapped in this HTML shell so it renders as a yellow cream quote-style callout (inline styles only; copy the structure exactly). Put the full placeholder text inside the inner italic paragraph only:

<aside class="weed-dr-expert-note" style="background-color:#FFFDF0;border-left:5px solid #E9D151;padding:1.25rem 1.5rem;margin:1.5rem 0;border-radius:0 4px 4px 0;">
<p style="margin:0 0 0.35rem 0;font-size:2rem;line-height:1;color:#E9D151;font-family:Georgia,Times New Roman,serif;">&ldquo;</p>
<p style="margin:0;font-style:italic;color:#333;font-size:1rem;line-height:1.65;">[DR. AUTHOR VOICE - topic: your specific 2-sentence instruction to the expert editor]</p>
</aside>

Placement (same as before):
1) After intro
2) After each major mechanistic/evidence section
3) Before conclusion

Each inner paragraph must contain specific 2-sentence editorial direction for the clinician (not a summary of the AI draft above).

CITATIONS (strict)
- Include at most 2 citations in the whole article. Choose only the most relevant, highest-value mechanistic or clinical claims to support.
- Each citation must include a clickable link: wrap anchor text in <a href="..." target="_blank" rel="noopener noreferrer">...</a>.
- href must point only to PubMed: either a specific article URL if you are confident it is correct, or a PubMed search URL built as https://pubmed.ncbi.nlm.nih.gov/?term= plus a tight URL-encoded query (author name + topic + year when helpful).
- Never invent PMIDs or fake article URLs. If unsure, use the search URL form only.
- Plain-language sentence should explain study type (animal, observational, RCT, review) before or beside the link.
- Do not add bare [CITE: ...] placeholders without a live PubMed link for these two slots. Optional short editor note in parentheses after the link is fine.
- No other external links anywhere in the article (internal links from the candidate list only, plus these max 2 PubMed links).

INTERNAL LINKING (strict)
- Use only the provided internal links/candidates.
- Anchor text must be specific and destination-descriptive.
- Do not use vague anchors like "this guide", "this breakdown", "this article", "read more", "learn more", "click here".
- If a long title is shortened, preserve meaning and topic fidelity.

PRODUCT/COMMERCE INTEGRATION
- Maximum one natural, non-pushy CTA in Learn article.
- Place CTA after the most commercially relevant section, not intro and not final conclusion.
- Product mentions must be context-led, never abrupt affiliate-style inserts.

FAQ RULES (when FAQ section is present)
- 5 to 8 FAQs.
- Questions should mirror real search phrasing.
- Each answer ~40-80 words and standalone.
- Avoid duplicate-value FAQs.

OUTPUT CONTRACT FOR THIS TOOL
- Return ARTICLE BODY in valid HTML only (no markdown/code fences).
- Do not output separate SEO BLOCK, EDITOR NOTES, or SEO LEAD NOTES sections in this API response.
- If needed, embed compliance/citation placeholders directly in the body where relevant.

QUALITY SELF-CHECK BEFORE RETURN
- Intro opens with real tension/question.
- Every [DR. AUTHOR VOICE] block is wrapped in the yellow aside shell above (quote mark + italic inner paragraph).
- [DR. AUTHOR VOICE] inner instructions are specific.
- At most 2 PubMed citation links total; each has valid pubmed.ncbi.nlm.nih.gov href; no other external domains.
- Primary keyword is not forced into the first sentence of the intro or into any heading.
- Internal links use precise anchors.
- Compliance lines included where relevant.
- Product CTA count is <= 1 and placement is correct.
- FAQ quality constraints are met.
- No disease-treatment claims.
If any check fails, revise before returning output.`;
}

export async function postGenerateContent(request: Request, toolScope: WPToolScope) {
  try {
    const body = await request.json();
    const { siteId, title, keywords, wordCount, editorialBrief, contentAngle, productTypeForLinks } = body;

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

    const productHint =
      typeof productTypeForLinks === "string" && productTypeForLinks.trim().length > 0
        ? productTypeForLinks.trim()
        : "";
    const candidateOpts = productHint ? { productTypeHint: productHint, productLinkSlots: 2 } : undefined;

    let internalLinks = await getCandidatesFromLibrary(
      site.id,
      keywords,
      title,
      INTERNAL_LINK_CANDIDATES_FOR_PROMPT,
      candidateOpts
    );
    if (internalLinks.length < LIBRARY_USE_MIN) {
      const posts = await getPosts(site, 100);
      internalLinks = pickCandidatesFromLivePosts(posts, keywords, title, INTERNAL_LINK_CANDIDATES_FOR_PROMPT);
    }

    const tonePrompt = site.tone_prompt ?? "Write in a clear, authoritative, and engaging editorial tone.";
    const systemPrompt = `${tonePrompt}
${brandAddendumForScope(toolScope)}
${weedLayer1BiblePrompt(toolScope)}

You are an expert SEO content writer. Write a complete blog post in valid HTML (not markdown).
Never wrap the output in code fences: do not use triple backticks, do not write \`\`\`html or \`\`\` before or after the HTML. Return raw HTML only.
Do NOT put the article title in the body: no <h1> and no title heading. The CMS sets the post title separately.
Start the body with an introduction using <p>, or the first <h2> section heading. Use <h2> and <h3> only inside the article. Target ${wordCount} words. Naturally embed 2-3 internal links
from the provided list using contextually appropriate anchor text. Do not add external links${toolScope === WP_TOOL_SCOPE.weedComContentProduction ? " except up to two PubMed links for citations as specified in the Weed Bible rules" : ""}.

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
    const sheetBrief =
      typeof editorialBrief === "string" && editorialBrief.trim().length > 0
        ? editorialBrief.trim().slice(0, 12000)
        : "";
    const angleBrief =
      typeof contentAngle === "string" && contentAngle.trim().length > 0
        ? `Content angle:\n${contentAngle.trim().slice(0, 4000)}`
        : "";
    const productBrief = productHint
      ? `Product type focus: include 1–2 relevant **product** internal links when they fit. The candidate list favors products matching: "${productHint}". Introduce each product with a short editorial setup (why this example fits the section) so it reads as a recommendation in context, not a sudden plug. If the list is thin, sync product links in Site manager.`
      : "";
    const briefExtra = [sheetBrief, angleBrief, productBrief].filter(Boolean).join("\n\n");
    const userMessage = `Title: ${title}

Keywords: ${keywords.join(", ")}${briefExtra ? `\n\n${briefExtra}` : ""}

Internal link candidates (pick 2-3 that best match nearby content; each URL at most once):
${linksText}

Write the full HTML blog post. Include the FAQ block as specified (1 or 2 FAQ subsections by topic fit, bullets in answers where it helps). Remember: no em dash character anywhere in the HTML. Do not output an <h1>; the post title is set only in WordPress. Start with <p> or <h2>.${toolScope === WP_TOOL_SCOPE.weedComContentProduction ? " Double-check every internal link: anchor text must be specific (never rely on 'this guide' / 'this breakdown' style phrasing). Product names must follow a clear contextual lead-in. Do not force the primary keyword into the opening of the first paragraph or into headings. Add at most 2 PubMed-linked citations for the strongest claims. Wrap every Dr. Alex [DR. AUTHOR VOICE] block in the yellow cream aside quote styling from the Bible rules." : ""}`;

    const raw = await callClaude(systemPrompt, userMessage, {
      maxTokens: Math.max(4096, Math.ceil(wordCount * 2.5)),
    });
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
    const status = isClaudeServiceUnavailableError(err) ? 503 : 500;
    return NextResponse.json({ error: msg || "Failed to generate content" }, { status });
  }
}
