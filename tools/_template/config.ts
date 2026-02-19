export type ToolConfig = {
  id: string;
  name: string;
  description?: string;
};

export const config: ToolConfig = {
  id: "_template",
  name: "Template Tool",
  description: "A template for creating new SEO tools.",
};
