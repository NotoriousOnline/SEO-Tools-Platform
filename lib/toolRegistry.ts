import type { ComponentType } from "react";
import type { ToolConfig } from "@/tools/_template/config";
import { config as templateConfig } from "@/tools/_template/config";
import TemplateTool from "@/tools/_template/index";

const toolRegistry: Record<string, { config: ToolConfig; component: ComponentType }> = {
  _template: {
    config: templateConfig,
    component: TemplateTool,
  },
};

export function getRegisteredTools(): ToolConfig[] {
  return Object.values(toolRegistry).map((t) => t.config);
}

export function getToolConfig(toolId: string): ToolConfig | undefined {
  return toolRegistry[toolId]?.config;
}

export function getToolComponent(toolId: string): ComponentType | undefined {
  return toolRegistry[toolId]?.component;
}
