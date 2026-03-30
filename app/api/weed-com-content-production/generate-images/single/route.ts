import { postGenerateImageSingle } from "@/lib/contentProduction/generateImageSinglePost";

export async function POST(request: Request) {
  return postGenerateImageSingle(request);
}
