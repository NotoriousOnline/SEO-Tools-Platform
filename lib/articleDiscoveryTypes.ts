export type ArticleDiscoveryPayload = {
  title: string;
  url: string;
  source: string;
};

export type FetchArticlesResponse = {
  articles: ArticleDiscoveryPayload[];
  source: "inoreader" | "rss" | "inoreader+rss";
  inoreaderError?: string;
};
