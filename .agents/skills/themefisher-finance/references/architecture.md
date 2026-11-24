# Architecture & Code Organization

Themefisher Admin Tools (Finance Tools Suite) is a Next.js App Router application built with TypeScript, Tailwind CSS v4, and Neon PostgreSQL with Drizzle ORM.

---

## 1. Directory Structure

```
├── public/                               # Static assets (logos, signatures)
├── src/
│   ├── actions/                          # Modular Next.js Server Actions
│   │   ├── index.ts                      # Central barrel export
│   │   ├── clients.ts                    # Client CRUD actions
│   │   ├── invoices.ts                   # Invoice CRUD actions
│   │   ├── payment-accounts.ts           # Payment receiving accounts CRUD
│   │   ├── vendors.ts                    # Vendors & employees CRUD actions
│   │   ├── debit-accounts.ts             # SCB debit source accounts
│   │   └── banks.ts                      # Bank branch queries & SWIFT lookup
│   ├── app/                              # Next.js App Router
│   │   ├── layout.tsx                    # Root layout
│   │   ├── globals.css                   # Global styles & @media print rules
│   │   ├── (dashboard)/                  # Persistent AppSidebar Layout Group
│   │   │   ├── layout.tsx                # AppSidebar persistent shell
│   │   │   ├── page.tsx                  # Server component: financial operations dashboard
│   │   │   ├── DashboardClient.tsx       # Client component: metrics, link share, recent feeds
│   │   │   ├── invoice-tools/            # Inward docs, Form-C, invoice creator, clients
│   │   │   ├── scb-tools/                # Bulk transaction generator, payment requests, vendors
│   │   │   └── settings/                 # Activity logs, MCP tokens, MCP logs, receiving accounts
│   │   ├── login/                        # Protected access login page (standalone)
│   │   ├── request-payment/              # Public beneficiary payment claim form (standalone)
│   │   └── track-payment/                # Public claim tracking page (standalone)
│   ├── components/                       # Modular UI Components
│   │   ├── index.ts                      # Central barrel export
│   │   ├── modals/                       # Standard modal dialogs
│   │   │   ├── Modal.tsx                 # Base standardized modal wrapper
│   │   │   ├── ConfirmDeleteModal.tsx    # Standard deletion & archive confirmation
│   │   │   ├── CreateClientModal.tsx     # Client creation modal
│   │   │   ├── CreateInvoiceModal.tsx    # Pre-filled invoice creation modal
│   │   │   ├── EditClientModal.tsx       # Client edit modal
│   │   │   └── EditInvoiceModal.tsx      # Invoice edit modal
│   │   ├── forms/                        # Form inputs & dropdowns
│   │   │   ├── BankBranchSelect.tsx      # Searchable Bangladesh bank/branch select
│   │   │   ├── SearchableClientSelect.tsx# Client searchable select
│   │   │   └── SearchableVendorSelect.tsx# Vendor searchable select
│   │   ├── layout/                       # Layout and navigation components
│   │   │   ├── InvoiceSidebar.tsx        # Invoice tools sidebar
│   │   │   └── SCBSidebar.tsx            # SCB tools sidebar
│   │   └── documents/                    # Printable A4 templates
│   │       ├── BankInvoice.tsx           # Printable bank invoice template
│   │       └── CForm.tsx                 # Bangladesh Bank Form-C template
│   ├── db/                               # Database client, schema, seed
│   │   ├── index.ts                      # NeonDB + Drizzle client instance
│   │   ├── schema.ts                     # PostgreSQL Drizzle schema
│   │   ├── seed.ts                       # Idempotent database seeder
│   │   └── data/
│   │       └── banks.json                # 11,426 Bangladesh bank branches dataset
│   ├── lib/
│   │   └── pdfParser.ts                  # Spatial coordinate MT103 PDF parser
│   └── types/
│       └── index.ts                      # Consolidated TypeScript interfaces
├── package.json
├── drizzle.config.ts
├── eslint.config.mjs
└── tsconfig.json
```

---

## 2. Server Actions Pattern

All database mutations and queries run strictly server-side using Next.js Server Actions with Drizzle ORM:

- **Location:** Defined in `src/actions/<domain>.ts` and re-exported via `src/actions/index.ts`.
- **Usage in Components:** Imported directly via `@/actions` (e.g. `import { getClients, createClient } from "@/actions"`).
- **Server Components:** `page.tsx` files fetch initial data using `await Promise.all([...])` and pass data down to `*Client.tsx` components to eliminate client-side loading waterfalls.

---

## 3. Component Architecture

Components are organized into strict functional subdirectories under `src/components/`:

- **`modals/`**: Accessible, animated popups built on a unified base `Modal.tsx`.
- **`forms/`**: Input components using `react-select/creatable` for fuzzy search and dynamic branch auto-complete.
- **`layout/`**: Sidebars with sticky navigation and hub redirection.
- **`documents/`**: Pixel-perfect A4 printing components using `react-to-print` and `@media print` CSS.
