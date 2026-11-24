# Development History & Evolution

This log preserves the evolution, architectural shifts, and technical decisions made throughout the project.

---

### 2026-11-24 — Remove Unused Zod Package & Migrate to pnpm
- Audited all dependencies across `src/`; identified `zod` as an obsolete remnant of the removed AI SDK.
- Removed `zod` from `package.json`.
- Removed `package-lock.json` and migrated package management to `pnpm`.
- Regenerated clean `pnpm-lock.yaml`.
- Updated documentation and skills runbooks to use `pnpm` commands (`pnpm db:push`, `pnpm db:seed`, `pnpm dev`, `pnpm build`, `pnpm lint`).
- Verified typechecking, linting, production build, and database seed (`pnpm run lint && pnpm run build && pnpm run db:seed`) with zero errors.

### 2026-11-23 — Completely Remove AI Chat, Legacy Fallbacks & Backward Compatibility Code
- Removed AI chat API route (`src/app/api/`) and components (`src/components/chat/`).
- Uninstalled all AI SDK dependencies (`@ai-sdk/google`, `@ai-sdk/groq`, `@ai-sdk/react`, `ai`, `react-markdown`).
- Removed all 14 backward-compatibility root component stubs; all imports now point to modular subdirectories (`modals/`, `forms/`, `layout/`, `documents/`).
- Deleted `src/app/actions.ts` and updated all callers to `@/actions`.
- Removed obsolete `supabase_schema.sql` and legacy `localStorage` employee caching.

### 2026-11-23 — Standardize File Structure, Clean Up App Files & Seed New Database
- Applied Drizzle schema migrations to Neon PostgreSQL database.
- Created idempotent seed script (`src/db/seed.ts`) and bundled Bangladesh Bank dataset (11,426 branches).
- Seeded default SCB debit account, payment account, international clients, and team members.
- Added standard database scripts (`db:push`, `db:seed`, `db:generate`, `db:migrate`, `db:studio`).
- Configured ESLint 9 for Next.js App Router and TypeScript.

### 2026-09-16 — Fix PDF Client Name Partial Matching
- Implemented 3-pass algorithm (exact → word-level fuzzy → full-text fallback).
- Noise words like "Ltd", "Inc", "Co", "Private", "Limited" are stripped during matching.
- 60% word-match threshold ensures partial names match reliably.

### 2026-09-15 — Switch to Fast Deterministic Spatial PDF Parser
- Replaced slow external LLM extraction with local spatial coordinate parser (`src/lib/pdfParser.ts`).
- Uses bounding box coordinates from `pdfjs-dist` to extract MT103 data deterministically with zero network latency.

### 2026-09-15 — Unified Modal Architecture
- Built standardized `Modal.tsx` wrapper and `ConfirmDeleteModal.tsx` with hide vs delete support.
- Replaced all native browser `window.confirm()` and `alert()` calls.

### 2026-09-14 — Migration to NeonDB with Drizzle ORM
- Migrated from client-side Supabase to Neon serverless PostgreSQL HTTP driver and Drizzle ORM.
- Centralized all database operations in server-side Next.js Server Actions.
- Converted application pages to Server Components with server-side data fetching to eliminate skeleton waterfalls.

### 2026-09-13 — Bangladesh Bank Branch Routing Number Integration & Salary Sheets
- Integrated 11,426 Bangladesh Bank branch records with 9-digit routing numbers.
- Added employee marking (`is_employee`), monthly salaries, and SCB bulk salary sheet generator.
