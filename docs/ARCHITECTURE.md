# Architecture

## SEO Tools Platform

### Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS (utility classes only)
- **Backend**: Supabase

### Folder Structure

```
/app
  layout.tsx       - Root layout with sidebar
  page.tsx         - Home page
  tools/[tool]/    - Dynamic tool routes
/components
  Sidebar.tsx      - Navigation sidebar
  ToolLayout.tsx   - Wrapper for tool pages
/tools
  _template/       - Template for new tools
    config.ts      - Tool configuration
    index.tsx      - Tool component
/lib
  supabase.ts      - Supabase client
  toolRegistry.ts  - Tool registration
```

### Tool Registry

Tools are registered in `lib/toolRegistry.ts`. Each tool has:
- `config`: id, name, description
- `component`: React component

To add a new tool, copy `tools/_template`, update config, and register in toolRegistry.
