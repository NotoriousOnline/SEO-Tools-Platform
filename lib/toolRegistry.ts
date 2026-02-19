import type { ComponentType } from "react";

export type ToolConfig = {
  slug: string;
  name: string;
  description?: string;
  icon?: string;
};

export const tools: ToolConfig[] = [];

const componentMap: Record<string, ComponentType> = {};

export function getToolConfig(slug: string): ToolConfig | undefined {
  return tools.find((t) => t.slug === slug);
}

export function getToolComponent(slug: string): ComponentType | undefined {
  return componentMap[slug];
}
