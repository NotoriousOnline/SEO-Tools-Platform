import type { ComponentType } from "react";
import { config as meetingToActionsConfig } from "@/tools/meeting-to-actions/config";
import MeetingToActionsTool from "@/tools/meeting-to-actions/index";
import { config as articleTitleDiscoveryConfig } from "@/tools/article-title-discovery/config";
import ArticleTitleDiscoveryTool from "@/tools/article-title-discovery/index";
import { config as contentProductionConfig } from "@/tools/content-production/config";
import ContentProductionTool from "@/tools/content-production/index";
import { config as weedComContentProductionConfig } from "@/tools/weed-com-content-production/config";
import WeedComContentProductionTool from "@/tools/weed-com-content-production/index";

export type ToolConfig = {
  slug: string;
  name: string;
  description?: string;
  icon?: string;
  requiresPassword?: boolean;
};

export const tools: ToolConfig[] = [
  {
    slug: meetingToActionsConfig.slug,
    name: meetingToActionsConfig.name,
    description: meetingToActionsConfig.description,
    icon: meetingToActionsConfig.icon,
    requiresPassword: meetingToActionsConfig.requiresPassword,
  },
  {
    slug: articleTitleDiscoveryConfig.slug,
    name: articleTitleDiscoveryConfig.name,
    description: articleTitleDiscoveryConfig.description,
    icon: articleTitleDiscoveryConfig.icon,
    requiresPassword: articleTitleDiscoveryConfig.requiresPassword,
  },
  {
    slug: contentProductionConfig.slug,
    name: contentProductionConfig.name,
    description: contentProductionConfig.description,
    icon: contentProductionConfig.icon,
    requiresPassword: contentProductionConfig.requiresPassword,
  },
  {
    slug: weedComContentProductionConfig.slug,
    name: weedComContentProductionConfig.name,
    description: weedComContentProductionConfig.description,
    icon: weedComContentProductionConfig.icon,
    requiresPassword: weedComContentProductionConfig.requiresPassword,
  },
];

const componentMap: Record<string, ComponentType> = {
  "meeting-to-actions": MeetingToActionsTool,
  "article-title-discovery": ArticleTitleDiscoveryTool,
  "content-production": ContentProductionTool,
  "weed-com-content-production": WeedComContentProductionTool,
};

export function getToolConfig(slug: string): ToolConfig | undefined {
  return tools.find((t) => t.slug === slug);
}

export function getToolComponent(slug: string): ComponentType | undefined {
  return componentMap[slug];
}
