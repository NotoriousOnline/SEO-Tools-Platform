import { ToolLayout } from "@/components/ToolLayout";
import { getToolConfig } from "@/lib/toolRegistry";

type Props = {
  params: Promise<{ tool: string }>;
};

export default async function ToolPage({ params }: Props) {
  const { tool } = await params;
  const config = getToolConfig(tool);

  if (!config) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-red-600">Tool not found</h1>
        <p className="mt-2 text-gray-600">The requested tool &quot;{tool}&quot; does not exist.</p>
      </div>
    );
  }

  return <ToolLayout tool={tool} config={config} />;
}
