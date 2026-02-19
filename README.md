# SEO Tools Platform

An open-source SEO toolkit built for developers and marketers to analyze, optimize, and improve website search performance. Includes essential tools like keyword analysis, on-page audits, backlink checks, and rank tracking — designed to be fast, modular, and easy to integrate.

Built with Next.js 14, App Router, TypeScript, and Tailwind CSS.

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env.local` and fill in your Supabase credentials.

3. Run the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000).

## Project Structure

- `/app` - Next.js App Router pages and layout
- `/components` - Reusable UI components (Sidebar, ToolLayout)
- `/tools` - Individual tool implementations (copy `_template` to create new tools)
- `/lib` - Utilities (Supabase client, tool registry)

## Adding a New Tool

1. Copy `tools/_template` to `tools/your-tool-name`
2. Update `config.ts` with your tool's id, name, and description
3. Implement your tool in `index.tsx`
4. Register the tool in `lib/toolRegistry.ts`
