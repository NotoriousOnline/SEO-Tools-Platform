import type { ArticleDiscoveryPayload } from "@/lib/articleDiscoveryTypes";
import { RSS_FEEDS } from "@/lib/rssFeeds";

type DiscoveryArticle = {
  title: string;
  url: string;
  source: string;
  pubDate: string;
};

function stripCdata(text: string): string {
  return text
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .trim();
}

function extractTagContent(xml: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = xml.match(regex);
  if (!match) return null;
  return stripCdata(match[1].trim());
}

function extractLink(itemXml: string): string | null {
  const linkContent = extractTagContent(itemXml, "link");
  if (linkContent && linkContent.startsWith("http")) return linkContent;
  const hrefMatch = itemXml.match(/<link[^>]+href=["']([^"']+)["']/i);
  return hrefMatch ? hrefMatch[1] : linkContent;
}

function parseItemsFromXml(xml: string, source: string): DiscoveryArticle[] {
  const articles: DiscoveryArticle[] = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = extractTagContent(itemXml, "title");
    const url = extractLink(itemXml);
    const pubDate = extractTagContent(itemXml, "pubDate");
    if (title && url) {
      articles.push({
        title,
        url,
        source,
        pubDate: pubDate ?? "",
      });
    }
  }
  return articles;
}

const PRIORITY_FEEDS = ["ENN", "ENN Climate", "ENN Energy", "ENN Pollution", "The Guardian Environment"];

/** Same pool logic as the original Article Title Discovery RSS fetcher. */
export async function fetchDiscoveryArticlesFromRss(): Promise<ArticleDiscoveryPayload[]> {
  const bySource: Record<string, DiscoveryArticle[]> = {};

  const fetchOrder = [
    ...RSS_FEEDS.filter((f) => PRIORITY_FEEDS.includes(f.name)),
    ...RSS_FEEDS.filter((f) => !PRIORITY_FEEDS.includes(f.name)),
  ];

  for (const feed of fetchOrder) {
    try {
      const res = await fetch(feed.url, {
        headers: { "User-Agent": "SEO-Tools-Platform/1.0" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      const articles = parseItemsFromXml(xml, feed.name);
      bySource[feed.name] = articles.sort((a, b) => {
        const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
        const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
        return dateB - dateA;
      });
    } catch (err) {
      console.error(`[article-discovery-rss] Feed ${feed.name} failed:`, err);
    }
  }

  const result: DiscoveryArticle[] = [];
  const addFrom = (source: string, max: number) => {
    const articles = bySource[source] ?? [];
    for (let i = 0; i < Math.min(max, articles.length) && result.length < 20; i++) {
      result.push(articles[i]);
    }
  };

  const ennSources = ["ENN", "ENN Climate", "ENN Energy", "ENN Pollution"];
  const ennPool = ennSources.flatMap((s) => bySource[s] ?? []).sort((a, b) => {
    const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return dateB - dateA;
  });
  for (let i = 0; i < Math.min(10, ennPool.length) && result.length < 20; i++) {
    result.push(ennPool[i]);
  }
  addFrom("The Guardian Environment", 10);
  const others = Object.entries(bySource)
    .filter(([name]) => !PRIORITY_FEEDS.includes(name))
    .flatMap(([, articles]) => articles)
    .sort((a, b) => {
      const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return dateB - dateA;
    });
  for (const a of others) {
    if (result.length >= 20) break;
    result.push(a);
  }

  return result.slice(0, 20).map(({ title, url, source }) => ({ title, url, source }));
}
