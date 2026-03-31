"use client";

import { ContentProductionTool } from "@/tools/content-production/ContentProductionTool";
import { config } from "./config";

export default function WeedComContentProductionToolPage() {
  return (
    <ContentProductionTool
      config={config}
      apiPrefix="/api/weed-com-content-production"
      showReferenceUrl={false}
      manualBriefFields
    />
  );
}
