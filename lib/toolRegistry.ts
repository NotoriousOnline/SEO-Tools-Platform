import type { ComponentType } from "react";
import { config as meetingToActionsConfig } from "@/tools/meeting-to-actions/config";
import MeetingToActionsTool from "@/tools/meeting-to-actions/index";

export type ToolConfig = {
  slug: string;
  name: string;
  description?: string;
  icon?: string;
};

export const tools: ToolConfig[] = [
  {
    slug: meetingToActionsConfig.slug,
    name: meetingToActionsConfig.name,
    description: meetingToActionsConfig.description,
    icon: meetingToActionsConfig.icon,
  },
];

const componentMap: Record<string, ComponentType> = {
  "meeting-to-actions": MeetingToActionsTool,
};

export function getToolConfig(slug: string): ToolConfig | undefined {
  return tools.find((t) => t.slug === slug);
}

export function getToolComponent(slug: string): ComponentType | undefined {
  return componentMap[slug];
}
