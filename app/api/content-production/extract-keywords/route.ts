import {
  extractKeywordsDynamic,
  extractKeywordsRuntime,
  postExtractKeywords,
} from "@/lib/contentProduction/extractKeywordsPost";
import { WP_TOOL_SCOPE } from "@/lib/wpSites";

export const dynamic = extractKeywordsDynamic;
export const runtime = extractKeywordsRuntime;

export async function POST(request: Request) {
  return postExtractKeywords(request, WP_TOOL_SCOPE.contentProduction);
}
