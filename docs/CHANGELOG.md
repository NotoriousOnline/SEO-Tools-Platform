# Changelog

## 2026-02-18 — Phase 1 Session Close

**Done:**
- Next.js 14 scaffold with App Router and TypeScript
- Tailwind CSS (utility classes only)
- lib/toolRegistry.ts with tools array (slug, name, description, icon)
- components/Sidebar.tsx with dynamic nav links and active route highlight
- components/ToolLayout.tsx shared wrapper
- app/layout.tsx with Sidebar and main content area (Tailwind flex)
- app/page.tsx dashboard home with welcome message and tools list from registry
- app/tools/[tool]/page.tsx dynamic route with ToolLayout
- tools/_template with config.ts and index.tsx (copy source only, not registered)
- lib/supabase.ts with env vars
- .env.example and .env.local in .gitignore
- Vercel deployment prep, push to main
- Documentation: SOW, ARCHITECTURE, CHANGELOG

**Next:**
- Phase 2: Auth (middleware, session checks, protected routes)
- Add first production tools (keyword analysis, on-page audit, etc.)
- Connect custom domain in Vercel

---

## [Unreleased]

### Added

- Initial Next.js 14 project scaffold with App Router
- TypeScript configuration
- Tailwind CSS (utility classes only)
- App layout with Sidebar component
- ToolLayout component for tool pages
- Dynamic route `/tools/[tool]`
- Tool template at `tools/_template`
- Tool registry in `lib/toolRegistry.ts`
- Supabase client in `lib/supabase.ts`
- Documentation: SOW, ARCHITECTURE, CHANGELOG
