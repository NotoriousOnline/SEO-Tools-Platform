import { getToolComponent, type ToolConfig } from "@/lib/toolRegistry";

type Props = {
  tool: string;
  config: ToolConfig;
};

export function ToolLayout({ tool, config }: Props) {
  const Component = getToolComponent(tool);

  return (
    <div className="flex flex-col p-4 sm:p-6 md:p-8 lg:p-12">
      <div className="mb-6 md:mb-10">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
          {config.name}
        </h1>
        {config.description && (
          <p className="mt-2 text-base text-slate-600 sm:mt-3 sm:text-lg">{config.description}</p>
        )}
      </div>
      <div className="flex-1">
        {Component ? <Component /> : null}
      </div>
    </div>
  );
}
