# Changelog

## 2026-02-24 — resolveOwner Import, Project Creation Fix

- Fixed resolveOwner import error in create-tasks route
- Fixed project creation — added full Asana error logging and conditional team field

---

## 2026-02-24 — Priority Prefix, Assignee Logging, Project Date Format

- Fixed priority display using emoji prefix fallback for Asana free trial
- Added resolveOwner debug logging to diagnose assignee mismatches
- Fixed project name date format from ISO timestamp to readable date

---

## 2026-02-24 — Auto Priority and Status on New Projects

- Auto Priority and Status fields now attached to every new Asana project on creation
- All tasks created with Priority and Status set automatically
- Retry logic added so tasks are always created even if custom fields fail

---

## 2026-02-23 — Auto-Create Project Wired to Flow

- Wired auto-create Asana project into task creation flow and UI
- Each meeting now creates its own Asana project; tasks assigned to new project
- Slack notification includes project link
- create-tasks accepts optional project_gid; notify-slack accepts optional project_url

---

## 2026-02-23 — Create Project Route

- Added create-project route — auto-creates Asana project per meeting
- POST /api/meeting-to-actions/create-project with meeting_title and date
- Adds Priority and Status custom fields to new project
- Returns project_gid, project_name, project_url on success; fallback_project_gid on failure

---

## 2026-02-23 — Fathom Meetings 503 Fix

- Fixed fathom-meetings 503 — added timeout handling, env var check, Vercel function config (maxDuration, force-dynamic)
- Added AbortController with 8s fetch timeout; returns 504 on timeout
- Returns 500 with clear message when FATHOM_API_KEY is missing
- Top-level try/catch to avoid unhandled 503

---

## 2026-02-23 — Asana Priority Fix

- Fixed Asana priority — now set via native custom field GID instead of name prefix
- Removed [HIGH]/[MEDIUM]/[LOW] prefix from task titles; priority uses custom_fields with ASANA_PRIORITY_FIELD_GID and enum option GIDs
- Added assignee to task creation via resolveOwner
- Log warning when ASANA_PRIORITY_FIELD_GID is not set

---

## 2026-02-21 — Asana Priority Custom Field

- Added support for Asana Priority custom field via env vars (ASANA_PRIORITY_FIELD_GID, ASANA_PRIORITY_HIGH_GID, etc.)
- Task titles still include [HIGH]/[MEDIUM]/[LOW] prefix when priority env vars are not set

---

## 2026-02-21 — Manual Entry UI

- Added Manual Entry tab to Meeting-to-Actions UI.

---

## 2026-02-21 — Manual Meeting Input

- Added manual meeting input route at /api/meeting-to-actions/manual
- Moved meeting state to shared lib/meetingStore.ts

---

## 2026-02-21 — Meeting-to-Actions Tool Complete

Done:
- Fathom webhook receiver + status route
- Claude AI processing (email summary + action extraction)
- Asana task creation with owner mapping and priority prefixes
- Gmail draft creation via OAuth
- Slack Block Kit notification
- Full 4-section UI with human approval flow
- End-to-end tested

Next:
- Phase 2: CRM integration (HubSpot / Salesforce)
- Phase 2: Sentiment analysis and risk signal detection
- Phase 2: Automatic follow-up reminder emails

---

## 2026-02-18 — Meeting-to-Actions UI

- Built full Meeting-to-Actions UI with 4-section approval flow.

---

## 2026-02-18 — Slack Notification

- Built Slack notification route.

---

## 2026-02-18 — Gmail Draft Creation

- Built Gmail draft creation route.

---

## 2026-02-18 — Asana Task Creation

- Built Asana task creation route.

---

## 2026-02-18 — AI Processing Route

- Built AI processing route — email summary and action extraction.

---

## 2026-02-18 — Fathom Webhook

- Built Fathom webhook receiver and status route.

---

## 2026-02-18 — Meeting-to-Actions Tool

- Registered meeting-to-actions tool in toolRegistry.

---

## 2026-02-18 — Configuration Verified

- All configuration verified — Anthropic, Asana, env vars, and utilities confirmed working. Ready to build Meeting-to-Actions features.

---

## 2026-02-18 — Owner Mapping

- Created /lib/ownerMapping.ts with Asana user GIDs and resolveOwner utility.

---

## 2026-02-18 — Environment Variables

- Added all env vars to .env.example (Supabase, Anthropic, Fathom, Trello, Gmail OAuth, Slack)

---

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
