import { getToolComponent, type ToolConfig } from "@/lib/toolRegistry";
import { getToolTheme } from "@/lib/dashboardBranding";

type Props = {
  tool: string;
  config: ToolConfig;
};

export function ToolLayout({ tool, config }: Props) {
  const Component = getToolComponent(tool);
  const theme = getToolTheme(tool);

  return (
    <div className="flex flex-col p-4 sm:p-6 md:p-8 lg:p-12">
      <div className={`mb-6 md:mb-10 pl-5 ${theme.headerAccent}`}>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
          {config.name}
        </h1>
        {config.description && (
          <p className={`mt-2 text-base sm:mt-3 sm:text-lg ${theme.descriptionClass}`}>{config.description}</p>
        )}
      </div>
      <div className="flex-1">{Component ? <Component /> : null}</div>
    </div>
  );
}
