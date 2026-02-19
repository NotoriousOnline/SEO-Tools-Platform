import Link from "next/link";
import { tools } from "@/lib/toolRegistry";

export default function HomePage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900">Welcome to SEO Tools Platform</h1>
      <p className="mt-2 text-gray-600">
        Analyze, optimize, and improve website search performance with our suite of tools.
      </p>
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Available Tools</h2>
        {tools.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {tools.map((tool) => (
              <li key={tool.slug}>
                <Link
                  href={`/tools/${tool.slug}`}
                  className="block rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300 hover:bg-gray-50"
                >
                  <span className="font-medium text-gray-900">{tool.name}</span>
                  {tool.description && (
                    <p className="mt-1 text-sm text-gray-500">{tool.description}</p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-gray-500">No tools registered yet.</p>
        )}
      </section>
    </div>
  );
}
