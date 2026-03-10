import type { ComponentType } from "react";
import { config as meetingToActionsConfig } from "@/tools/meeting-to-actions/config";
import MeetingToActionsTool from "@/tools/meeting-to-actions/index";
import { config as articleTitleDiscoveryConfig } from "@/tools/article-title-discovery/config";
import ArticleTitleDiscoveryTool from "@/tools/article-title-discovery/index";

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
];

const componentMap: Record<string, ComponentType> = {
  "meeting-to-actions": MeetingToActionsTool,
  "article-title-discovery": ArticleTitleDiscoveryTool,
};

export function getToolConfig(slug: string): ToolConfig | undefined {
  return tools.find((t) => t.slug === slug);
}

export function getToolComponent(slug: string): ComponentType | undefined {
  return componentMap[slug];
}
