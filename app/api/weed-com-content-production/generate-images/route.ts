import { postGenerateImages } from "@/lib/contentProduction/generateImagesPost";
import { WP_TOOL_SCOPE } from "@/lib/wpSites";

export async function POST(request: Request) {
  return postGenerateImages(request, WP_TOOL_SCOPE.weedComContentProduction);
}
