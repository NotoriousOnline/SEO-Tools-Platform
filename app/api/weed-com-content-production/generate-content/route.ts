import { postGenerateContent } from "@/lib/contentProduction/generateContentPost";
import { WP_TOOL_SCOPE } from "@/lib/wpSites";

export async function POST(request: Request) {
  return postGenerateContent(request, WP_TOOL_SCOPE.weedComContentProduction);
}
