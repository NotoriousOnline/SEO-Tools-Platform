import { NextResponse } from "next/server";

const SYSTEM_PROMPT =
  "You are a content strategist for green.org, an environmental news and lifestyle website. Your job is to take inspiration from existing environmental news articles and suggest a fresh, engaging article title that would perform well on green.org. The title should feel original — not a rewrite — but inspired by the same topic or angle.";

function buildUserPrompt(title: string, url: string): string {
  return `Source article: ${title}
Source URL: ${url}

Suggest one compelling article title for green.org inspired by this topic. Return ONLY a JSON object in this exact format:
{ "suggested_title": "Your Title Here" }`;
}

type InputArticle = { title: string; url: string; source: string };

type OutputItem = {
  suggested_title: string;
  source_title: string;
  source_url: string;
  source_name: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set" },
      { status: 500 }
    );
  }

  let body: { articles?: InputArticle[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const articles = Array.isArray(body.articles) ? body.articles : [];
  if (articles.length === 0) {
    return NextResponse.json(
      { error: "articles array is required and must not be empty" },
      { status: 400 }
    );
  }

  const results: OutputItem[] = [];

  for (let i = 0; i < articles.length; i++) {
    if (i > 0) await sleep(300);

    const article = articles[i];
    const userPrompt = buildUserPrompt(article.title, article.url);

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[generate-titles] OpenAI API error for "${article.title}":`, res.status, errText);
        continue;
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content?.trim();
      if (!content) {
        console.error(`[generate-titles] Empty response for "${article.title}"`);
        continue;
      }

      let parsed: { suggested_title?: string };
      try {
        const jsonStr = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
        parsed = JSON.parse(jsonStr) as { suggested_title?: string };
      } catch (parseErr) {
        console.error(`[generate-titles] JSON parse failed for "${article.title}":`, content, parseErr);
        continue;
      }
      const suggestedTitle = parsed?.suggested_title;
      if (typeof suggestedTitle !== "string" || !suggestedTitle.trim()) {
        console.error(`[generate-titles] Invalid suggested_title for "${article.title}":`, content);
        continue;
      }

      results.push({
        suggested_title: suggestedTitle.trim(),
        source_title: article.title,
        source_url: article.url,
        source_name: article.source,
      });
    } catch (err) {
      console.error(`[generate-titles] Failed to process "${article.title}":`, err);
    }
  }

  return NextResponse.json(results);
}
