import { getToolComponent, type ToolConfig } from "@/lib/toolRegistry";

type Props = {
  tool: string;
  config: ToolConfig;
};

export function ToolLayout({ tool, config }: Props) {
  const Component = getToolComponent(tool);

  return (
    <div className="flex flex-col p-8 lg:p-12">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 lg:text-4xl">
          {config.name}
        </h1>
        {config.description && (
          <p className="mt-3 text-lg text-slate-600">{config.description}</p>
        )}
      </div>
      <div className="flex-1">
        {Component ? <Component /> : null}
      </div>
    </div>
  );
}
