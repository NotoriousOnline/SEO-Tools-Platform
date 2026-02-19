import { getToolComponent } from "@/lib/toolRegistry";
import type { ToolConfig } from "@/tools/_template/config";

type Props = {
  tool: string;
  config: ToolConfig;
};

export function ToolLayout({ tool, config }: Props) {
  const Component = getToolComponent(tool);

  return (
    <div className="flex flex-col p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{config.name}</h1>
        {config.description && (
          <p className="mt-1 text-gray-600">{config.description}</p>
        )}
      </div>
      {Component ? <Component /> : null}
    </div>
  );
}
