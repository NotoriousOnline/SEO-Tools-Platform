"use client";

import { ContentProductionTool } from "./ContentProductionTool";
import { config } from "./config";

export default function ContentProductionToolPage() {
  return <ContentProductionTool config={config} />;
}
