import { postPublish } from "@/lib/contentProduction/publishPost";
import { WP_TOOL_SCOPE } from "@/lib/wpSites";

export async function POST(request: Request) {
  return postPublish(request, WP_TOOL_SCOPE.contentProduction);
}
