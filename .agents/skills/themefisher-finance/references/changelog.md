# Development History & Evolution

This log preserves the evolution, architectural shifts, and technical decisions made throughout the project.

---

### 2026-11-24 — Public Payment Request Form & Automated SCB Generation

- Added public payment claim workflow enabling external beneficiaries/contractors to submit banking details and claim amounts via unauthenticated public route `/request-payment`.
- Created `payment_requests` table in NeonDB with schema indexes for tracking code, status (`pending`, `verified`, `approved`, `rejected`, `exported`), routing details, duplicate flags, and SCB export metadata (`exported_at`, `scb_file_name`).
- Configured Edge proxy in `src/proxy.ts` to allow public traffic to `/request-payment` without authentication while keeping all other tools protected.
- Integrated automated verification engine: validates 9-digit BEFTN routing numbers against the 11,426 Bangladesh Bank branch records, detects duplicate claims in the last 30 days, and checks existing registered vendors.
- Built dedicated admin management interface at `/scb-tools/payment-requests` with live status tabs (`Actionable`, `Approved`, `Exported`, `Rejected`), 1-click approvals with optional beneficiary auto-registration into `vendors`, and instant single or bulk SCB Straight2Bank Excel exports.
- Added `payment_requests` scope and three native MCP tools (`finance_payment_requests_list`, `finance_payment_requests_get`, `finance_payment_requests_verify`) allowing AI agents to audit claims, append verification notes, and queue requests for 1-click human approval.
- Added "Payment Requests" navigation link with badge indicator in `SCBSidebar.tsx`.

---

### 2026-11-24 — Settings & Logs Reorganization & MCP Log Tools

- Created unified `/settings` architecture with dedicated `SettingsSidebar` matching the design system of `SCBSidebar` and `InvoiceSidebar`.
- Consolidated subroutes: `/settings/activity-logs` (app activity audit trail without stats cards), `/settings/mcp-setup` (AI agent MCP tokens & client configs), `/settings/mcp-logs` (agent execution telemetry), and `/settings/payment-accounts` (receiving bank accounts).
- Removed legacy `/mcp/`, `/activity-logs/`, `/invoice-tools/settings/`, and `McpSidebar.tsx`.
- Added `logs` scope to `MCP_SCOPES` and created two new native MCP tools (`finance_logs_list` and `finance_logs_get_excel_export`), enabling AI agents connected via Model Context Protocol to query application activity and examine past Excel exports.
- Updated main dashboard Card 3 (`Settings & Logs`), top header, and navigation sidebars.

---

### 2026-11-24 — Finance Constraints and Private Configuration

- Added migrations for protected invoice references, unique debit defaults, and scoped MCP write reservations.
- Removed private seed records and public account fallbacks, prompted for protected PDF passwords, and stopped writing financial payloads to new MCP logs.
- Added shared invoice field validation, cached bank routing lookups, and removed browser persistence of SCB accounts and salaries.
- Overrode the migration loader’s esbuild dependency to the patched version already used by the project.

### 2026-11-24 — Finance Remediation Implementation

- Require browser sessions inside financial Server Actions and restrict MCP overview and salary data by token scope.
- Bundle PDF.js and its worker locally, cap PDF file size and page count, and update SheetJS to 0.20.3.
- Share debit default switching across UI and MCP, allocate invoice numbers when the reference is blank, and validate SCB exports before creating workbooks.
- Run lint, tests, production builds, and dependency audit checks in CI.

### 2026-11-24 — Finance Review, Routing, and Document Hardening

- Require both client and invoice scopes for MCP client deletions because linked invoices are deleted by the database cascade.
- Preserve the routing number of the selected bank branch in vendor forms. MCP routing lookups report ambiguous names instead of selecting an arbitrary match.
- Share day-first MT103 date conversion, disable PDF.js evaluation, and release the PDF worker after extraction.
- Centralize safe login redirects, defer SCB workbook loading until export, and remove unused UI modules and their OTP dependency.

### 2026-11-24 — Next.js 16 Proxy Migration & Global Typography Refinement

- Migrated deprecated Next.js `src/middleware.ts` to `src/proxy.ts` exporting `proxy()` to adhere to Next.js 16 conventions and eliminate deprecation warnings.
- Increased base font size `--font-base` from 16px to 18px in `src/styles/theme.css` to improve overall readability across all tools.
- Included font weight `500` for primary font (Heebo) in `src/app/layout.tsx`.
- Updated base heading and inline text rules in `src/styles/base.css`: restricted bold font weights (`font-secondary font-bold`) exclusively to primary headers (`h1`, `h2`), while setting subheadings (`h3`-`h6`), `b`, and `strong` to normal font weight.
- Replaced bold/semibold weights on non-header UI elements across all pages and modals (client/vendor list rows, form labels, table cells, buttons, tabs, badges, and sidebar navigation links) with normal or medium font weights.
- Replaced fixed tiny font classes (`text-[11px]`, `text-[10px]`) with responsive rem-based classes (`text-xs`, `text-sm`) to properly scale with the new root font size.

### 2026-11-24 — Site-Wide Password Protection & Setup Safeguards

- Added Next.js Edge Middleware (`src/middleware.ts`) to intercept all incoming requests and lock down the entire application.
- Implemented Edge-compatible Web Crypto token generation (`src/lib/auth.ts`) using SHA-256 with `AUTH_PASSWORD` and `AUTH_SECRET`.
- Stored session tokens in secure `httpOnly`, `sameSite: "lax"`, `maxAge: 30 days` cookies.
- Created `/login` page with brand-aligned card layout and responsive password visibility toggle.
- Added `loginAction` and `logoutAction` Server Actions in `src/actions/auth.ts`.
- Integrated `LogoutButton` in main `Header` as well as `InvoiceSidebar` and `SCBSidebar`.
- Polished Header controls: removed redundant navigation menu items, adjusted `ThemeSwitcher` to `h-9 w-9` (size-9) with matching `border-border`, and upgraded `LogoutButton` to a proper button with icon and text matching button height.
- Implemented environment safeguard: when `AUTH_PASSWORD` or `AUTH_SECRET` is unset/empty, all sub-routes redirect to the homepage (`/`), where an informative "Setup Required" card is displayed indicating that environment variables must be configured.

### 2026-11-24 — Standardize Container Sizes & Add Loading Skeletons

- Standardized container width across all pages (`/`, `/invoice-tools`, `/invoice-tools/create-invoice`, `/invoice-tools/clients`, `/invoice-tools/settings`, `/scb-tools`, `/scb-tools/vendors`, `/scb-tools/debit-accounts`) to `max-w-7xl mx-auto`.
- Updated `.container` in `src/styles/components.css` to `max-w-7xl`.
- Created tailored loading skeleton components for all routes: `InvoiceToolsSkeleton`, `CreateInvoiceSkeleton`, `ClientsSkeleton`, `SettingsSkeleton`, `ScbToolsSkeleton`, `DebitAccountsSkeleton`, `VendorsSkeleton`, and reusable `TableRowsSkeleton`.
- Added Next.js App Router route loading skeletons (`loading.tsx`) across all routes in `invoice-tools` and `scb-tools`.
- Replaced plain text and spinner loading indicators in `ClientsClient`, `SettingsClient`, `DebitAccountsClient`, and `VendorsClient` with animated skeleton components to prevent layout shifts.

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
