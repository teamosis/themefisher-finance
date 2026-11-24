---
name: themefisher-finance
description: >-
  Architecture, business workflows, database schema, and operational guide for Themefisher Admin Tools
  (Invoice & Form-C Generator and SCB Bulk Transaction Generator). Use whenever working on finance tools.
---

# Themefisher Finance Tools Guide

A unified internal financial operations suite for [Themefisher](https://themefisher.com) handling international inward remittance billing (Invoices + Bangladesh Bank Form-C) and Standard Chartered Bank (SCB) Straight2Bank bulk transaction Excel exports.

---

## 1. Quick Reference & Core Stack

| Layer | Technology | Details |
| --- | --- | --- |
| **Framework** | Next.js 16.3.4 (App Router, Turbopack) | Server Components + Server Actions |
| **Language** | TypeScript 5 (Strict mode) | `noUnusedLocals`, `noUnusedParameters` enabled |
| **Styling** | Tailwind CSS v4 | Native `@media print` A4 document styles |
| **Database** | NeonDB (Serverless PostgreSQL) | `@neondatabase/serverless` HTTP driver |
| **ORM** | Drizzle ORM (`drizzle-orm`) | Schema in `src/db/schema.ts` |
| **Document Export** | `react-to-print`, `xlsx` | A4 PDF printing and SCB Excel files |
| **PDF Parser** | `pdfjs-dist` (Spatial coordinate parser) | Password `PDF_PASSWORD` env (prompts if missing or incorrect) |

---

## 2. Environment Variables

Store in `.env.local` (never commit):

```env
DATABASE_URL=postgresql://user:password@ep-...neon.tech/neondb?sslmode=require
AUTH_PASSWORD=change_this_to_your_secure_password
AUTH_SECRET=optional_random_secret_for_signing
PDF_PASSWORD=your_pdf_password_here
```

Use authenticated debit account settings for SCB accounts.

---

## 3. Architecture & Code Structure

The project follows standard Next.js App Router conventions with domain-separated Server Actions and modular components:

- **Server Actions (`src/actions/`):** All database reads and mutations are server-side actions in domain modules (`clients.ts`, `invoices.ts`, `payment-accounts.ts`, `vendors.ts`, `debit-accounts.ts`, `banks.ts`). Callers import directly from `@/actions`.
- **Components (`src/components/`):** Organized into domain subdirectories:
  - `modals/` — Accessible popups (`Modal.tsx`, `ConfirmDeleteModal.tsx`, `CreateClientModal.tsx`, etc.)
  - `forms/` — Input controls and searchable dropdowns (`BankBranchSelect.tsx`, `SearchableClientSelect.tsx`, etc.)
  - `layout/` — Sidebars (`InvoiceSidebar.tsx`, `SCBSidebar.tsx`)
  - `documents/` — Printable A4 templates (`BankInvoice.tsx`, `CForm.tsx`)
- **App Routes (`src/app/`):**
  - `/` — Central tools selector hub
  - `/invoice-tools` — Document viewer, Form-C & Bank Invoice printer
  - `/invoice-tools/create-invoice` — Invoice creator & MT103 remittance PDF parser
  - `/invoice-tools/clients` — International client directory
  - `/invoice-tools/settings` — Themefisher receiving bank accounts
  - `/scb-tools` — Bulk transaction generator & XLSX exporter
  - `/scb-tools/vendors` — Beneficiary & employee directory
  - `/scb-tools/debit-accounts` — SCB funding sources

For the complete file tree and design patterns, see [architecture.md](./references/architecture.md).

---

## 4. Database Operations & Seeding

The database is managed with Drizzle ORM against Neon PostgreSQL.

### Core Commands

```bash
# Push schema updates directly to NeonDB
pnpm db:push

# Seed database with initial data & 11,426 Bangladesh bank branches
pnpm db:seed

# Generate Drizzle migration files
pnpm db:generate

# Execute Drizzle migrations
pnpm db:migrate

# Open visual Drizzle Studio database browser
pnpm db:studio
```

For schema definition and column details, see [database.md](./references/database.md).

---

## 5. Domain Rules & Financial Workflows

1. **Invoice Numbering:** Auto-generated format `TF-YYYY-MM-DD-XX`. Must be unique in the database.
2. **Form-C Declaration:** Bangladesh Bank inward remittance declaration. Date represents current submission date. Remitted amount reflects net remittance received.
3. **Remittance PDF Parsing:** Fast deterministic spatial extraction (`src/lib/pdfParser.ts`) with `PDF_PASSWORD` env support and password prompt fallback for protected files. Uses 3-pass fuzzy client name matching.
4. **SCB Straight2Bank Bulk Excel:** Exported `.xlsx` files conform strictly to SCB specifications.
5. **Bank Branch Routing:** 11,426 branches across 63 banks. Selecting a bank dynamically filters branches and auto-populates the 9-digit routing number.
6. **Salary Sheets:** Filters vendors where `is_employee: true`. Allows salary adjustments, additional bonus/allowance rows, and real-time total payroll calculations.

For complete business logic specifications, see [business-rules.md](./references/business-rules.md).

---

## 6. Developer Runbook & Best Practices

1. **Server Components First:** Fetch data in Server Components (`page.tsx`) using `await Promise.all([...])` and pass initial props to client components to avoid hydration delays.
2. **Importing Actions & Components:**
   - Server Actions: `import { ... } from "@/actions";`
   - Modals: `import { ... } from "@/components/modals/<ModalName>";`
   - Forms: `import { ... } from "@/components/forms/<FormName>";`
   - Barrel export: `import { ... } from "@/components";`
3. **Destructive Actions:** Always use `ConfirmDeleteModal` instead of native `window.confirm()`. Support `is_hidden` archiving for vendors where appropriate.
4. **Strict Type Checking:** Always verify with `pnpm lint` and `pnpm build` before committing.

---

## 7. Technical Evolution & Changelog

For the historical log of architectural decisions and migrations (including the migration from Supabase to NeonDB + Drizzle), see [changelog.md](./references/changelog.md). Only record major architectural decisions, database migrations, or business rule updates essential for future context. Routine bug fixes, lint/config adjustments, or minor tweaks must not be added.
