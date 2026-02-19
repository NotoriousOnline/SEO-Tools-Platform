import type { ComponentType } from "react";
import TemplateTool from "@/tools/_template/index";

export type ToolConfig = {
  slug: string;
  name: string;
  description?: string;
  icon?: string;
};

export const tools: ToolConfig[] = [
  {
    slug: "_template",
    name: "Template Tool",
    description: "A template for creating new SEO tools.",
    icon: "layout",
  },
];

const componentMap: Record<string, ComponentType> = {
  _template: TemplateTool,
};

export function getToolConfig(slug: string): ToolConfig | undefined {
  return tools.find((t) => t.slug === slug);
}

export function getToolComponent(slug: string): ComponentType | undefined {
  return componentMap[slug];
}
