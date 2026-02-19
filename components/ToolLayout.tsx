import { getToolComponent, type ToolConfig } from "@/lib/toolRegistry";

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
      <div className="flex-1">
        {Component ? <Component /> : null}
      </div>
    </div>
  );
}
