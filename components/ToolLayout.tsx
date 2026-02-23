import { getToolComponent, type ToolConfig } from "@/lib/toolRegistry";

type Props = {
  tool: string;
  config: ToolConfig;
};

export function ToolLayout({ tool, config }: Props) {
  const Component = getToolComponent(tool);

  return (
    <div className="flex flex-col p-8 lg:p-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 lg:text-3xl">
          {config.name}
        </h1>
        {config.description && (
          <p className="mt-2 text-slate-600">{config.description}</p>
        )}
      </div>
      <div className="flex-1">
        {Component ? <Component /> : null}
      </div>
    </div>
  );
}
