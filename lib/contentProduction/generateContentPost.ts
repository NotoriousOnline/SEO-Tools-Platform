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
Version: Bible v6 | April 2026
This is Layer 1 only and must be edited by a human expert before publish.

SYSTEM ROLE
You are a professional cannabis content writer producing Layer 1 first drafts for Weed.com Learn.
Follow Bible v6 strictly. Drafts are structured, evidence-referenced, and brief-compliant.

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

DR. ALEXANDER TABIBI ATTRIBUTION (mandatory where applicable)
Positioning: Dr. Alexander Tabibi is a former physician and independent science writer who interrogates evidence critically. He is not a practising clinician. He does not advise patients.
Where required: All health, dosage, pharmacological, and drug-interaction content. A missing or generic attribution on this content type is a BLOCKER - the article cannot go live.
Correct formats (use naturally in prose):
- "Dr. Alexander Tabibi, a former physician and independent science writer, notes that…"
- "According to Dr. Alexander Tabibi…"
- "As Dr. Tabibi explains…"
Example in context: "Dr. Alexander Tabibi, a former physician and independent science writer, points to evidence suggesting that myrcene may contribute to sedative effects - though he notes individual responses vary significantly."
Hard rules - never write:
- Anything implying "in his clinical practice" or that he advises or recommends what patients should take or do as a treating doctor.
- "Reviewed by a medical professional" or other generic attribution without his full name (Dr. Alexander Tabibi) where attribution is required.
- Any language implying he is currently practising medicine or treating patients.

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

Each inner paragraph must contain specific 2-sentence editorial direction for the expert editor (not a summary of the AI draft above), including Tabibi attribution direction when the adjacent section warrants it (per rules above).

CITATIONS (strict — one paper, one PMID link)
- Include at most 2 citations in the whole article. Use them only for the strongest mechanistic or clinical claims.
- A real citation is a specific peer-reviewed paper (known authors, journal, year), not a keyword search. PubMed search URLs are forbidden: any href containing pubmed.ncbi.nlm.nih.gov/?term= (or other query-string search) is unacceptable — it is not stable, not verifiable, and useless to readers and fact-checkers.
- Required link pattern only: a single PubMed record page using the numeric PMID in the path — https://pubmed.ncbi.nlm.nih.gov/31860793/ style (digits only; no ?term=, no /pubmed/ search, no invented paths).
- In the same sentence or the immediately following sentence, name the source in readable bibliographic form: lead author et al., journal, year (e.g. Blount et al., N Engl J Med, 2020). You may add a DOI in plain text beside it when you know it; the clickable href must still be the PubMed PMID URL above.
- Anchor text must be specific (e.g. "Blount et al. (NEJM, 2020)" or the study's identifiable short label), never vague ("a study," "research shows," "read more").
- Never invent PMIDs, journals, volumes, or pages. If you cannot confirm an exact PMID for the paper you mean, do not substitute a search URL: omit that citation and use a [DR. AUTHOR VOICE] instruction asking the human editor to insert a verified PMID link and full reference.
- Keep a plain-language clause on study design where it helps (RCT, cohort, case series, review, etc.).
- No bare [CITE: ...] placeholders without a live PMID article URL. Optional brief editor note in parentheses after the link is fine.
- No other external links or domains in the article (internal links from the candidate list only, plus at most these 2 PubMed PMID links).

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
- No Dr. Tabibi name or attribution language in the main body; Tabibi rules appear only inside [DR. AUTHOR VOICE - ...] instructions where health/dosage/pharmacology/interactions are in scope.
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

Write the full HTML blog post. Include the FAQ block as specified (1 or 2 FAQ subsections by topic fit, bullets in answers where it helps). Remember: no em dash character anywhere in the HTML. Do not output an <h1>; the post title is set only in WordPress. Start with <p> or <h2>.${toolScope === WP_TOOL_SCOPE.weedComContentProduction ? " Double-check every internal link: anchor text must be specific (never rely on 'this guide' / 'this breakdown' style phrasing). Product names must follow a clear contextual lead-in. Do not force the primary keyword into the opening of the first paragraph or into headings. At most 2 citations; each must use a verified PMID article URL only (https://pubmed.ncbi.nlm.nih.gov/<digits>/) — never PubMed ?term= search links — with author/journal/year in adjacent text. Wrap every Dr. Alex [DR. AUTHOR VOICE] block in the yellow cream aside quote styling from the Bible rules." : ""}`;

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
