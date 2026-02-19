import { config } from "./config";

export default function TemplateTool() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-medium text-gray-900">{config.name}</h2>
      <p className="mt-2 text-sm text-gray-500">{config.description}</p>
      <div className="mt-4 rounded-md border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-400">
        Placeholder UI — replace with your tool content
      </div>
    </div>
  );
}
