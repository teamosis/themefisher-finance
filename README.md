# Business Finance & Banking Suite

A unified Next.js application that brings together international inward remittance billing, Bangladesh Bank Form-C generation, and Standard Chartered Bank (SCB) bulk transaction Excel export into a single repository, single deployment, and single database.

---

## 🎯 Key Capabilities

### 1. Central Tools Dashboard (`/`)

- Interactive cards/tiles for each specialized financial tool.
- Real-time live status metrics (Clients, Invoices, Payment Accounts, Vendors, Debit Accounts).
- Quick-action shortcuts directly into tool sub-features.
- One-click instant navigation with dedicated **"← Dashboard Hub"** home buttons in every tool.

### 2. Invoice & Form-C Generator (`/invoice-tools`)

- **Official Form-C (ICT)**: Bangladesh Bank declaration format for inward remittance exceeding USD 10,000.
- **Bank Invoice**: Clean invoice layout with remitter/beneficiary details and client details.
- **Pixel-Perfect A4 Printing**: Embedded `@media print` engine with one-click print and PDF export.
- **Auto-Numbered Invoicing**: Sequential invoice generator (`TF-YYYY-MM-DD-XX`).
- **Client & Payment Directory**: Manage international clients with overseas bank details and tax IDs.

### 3. SCB Bulk Transection Generator (`/scb-tools`)

- **Bulk Excel (.xlsx) Export**: Produces bank transfer sheets compliant with SCB format specifications.
- **Beneficiary Vendor Pool**: Full CRUD directory for vendor bank accounts, branches, and 9-digit routing codes.
- **Multi-Account Debit Sources**: Maintain funding accounts with default account auto-selection.
- **Multi-Row Batch Grid**: Add, delete, and duplicate transfer entries with autocomplete receiver search.

---

## 🚀 Quick Start

### 1. Configure Environment Variables

Create `.env.local` based on `.env.example`:

```bash
cp .env.example .env.local
```

Fill in your NeonDB configuration:

```env
DATABASE_URL=postgresql://user:password@host.tld/dbname?sslmode=require
```

### 2. Setup Database & Seed

Push the Drizzle schema to your Neon PostgreSQL database and seed the public bank routing directory:

```bash
pnpm db:push
pnpm db:seed
```

Configure clients, vendors, receiving accounts, and debit accounts through their authenticated screens. Seed only imports the public routing directory. Protected PDFs prompt for their password during upload.

### Existing database upgrades

Back up the database and use a staging copy to compare its schema with `src/db/schema.ts` before upgrading. Generate and review any required schema changes against the deployed version before applying them.

The schema defines a cascade from clients to invoices. Confirm whether a client has invoice history before deleting it. Existing browser sessions require a fresh sign-in after the signed session update.

MCP clients may send an `idempotencyKey` on writes and should reuse that key after transport failures. A completed retry replays a compact receipt with the available recovery references. A pending key requires checking the underlying record before any further attempt. New MCP log entries store execution metadata without request or response bodies. Other database environments need the nullable `mcp_write_requests.receipt` JSONB column from the current Drizzle schema before deploying the receipt update.

### 3. Run Locally

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## MCP access

Open **MCP Setup** (`/mcp-setup`), generate a scoped token, and copy the JSON config into a client that supports Streamable HTTP and bearer headers. The endpoint is `/api/mcp` on the app origin. For a custom deployment, set `NEXT_PUBLIC_APP_URL` to its origin so the workflow links point to the right site.

Call the relevant tool directly when your client shows its schema. For discovery, read `finance://workflows` or use `tools/list`. Use `finance_get_overview` for a connection check or account summary. The catalog lists the tools your token can use and links to Form-C and invoice printing, MT103 PDF import, and the public payment pages.

- Omit the invoice number and provide an `idempotencyKey` to allocate the number on the server. A token with clients scope can supply a client name and receives candidates when the name is ambiguous. Bank routing lookup accepts routing codes and returns branch candidates for ambiguous names.
- For payment requests and logs, pass the returned `nextCursor` as `cursor` with the same filters to continue listing records.
- Use `finance_scb_prepare_workbook` with the vendors and accounts scopes to prepare a transfer workbook. Payroll preparation also requires payroll scope. Use `allActiveEmployees: true` for payroll with optional exclusions, overrides in `items`, and `additionalItems`. Save `xlsxBase64` as a decoded binary file using the returned filename.
- Use the **Payment Request Decisions & Exports** scope on a write-enabled token for submission, approval, rejection, and export. Submission returns the request UUID and verification summary. For approval, show the operator the returned `review` fields and verification, then pass the same `review` with `operatorConfirmed: true`. Use an `idempotencyKey` for each decision. Final export and workbook recovery also require accounts scope. Use `finance_payouts_get_workbook` with a request ID to recover an export after a lost response.
- Use `finance_invoices_parse_remittance` to extract an invoice draft from an MT103 PDF up to 180 KiB and 10 pages. Review the extracted fields before creating the invoice. Use the browser import for larger files.
- The workflow catalog and invoice lookup link to browser printing for the official invoice and Form-C layouts. Create and rotate MCP tokens from MCP Setup.

## 📁 Architecture & Structure

```
finance-tools-suite/
├── public/                     # Static assets (logos, signatures, icons)
├── src/
│   ├── actions/                # Next.js Server Actions (CRUD by domain)
│   │   ├── index.ts
│   │   ├── clients.ts
│   │   ├── invoices.ts
│   │   ├── payment-accounts.ts
│   │   ├── vendors.ts
│   │   ├── debit-accounts.ts
│   │   └── banks.ts
│   ├── app/                    # Next.js App Router routes
│   │   ├── page.tsx            # Main Tools Dashboard
│   │   ├── layout.tsx          # Root Application Layout
│   │   ├── globals.css         # Tailwind & A4 Print Media Queries
│   │   ├── invoice-tools/      # Tool 1: Invoice & Form-C Suite
│   │   └── scb-tools/          # Tool 2: SCB Transaction Generator
│   ├── components/             # Modular UI Components
│   │   ├── index.ts            # Central barrel export
│   │   ├── modals/             # Modal dialogs
│   │   ├── forms/              # Form controls & searchable dropdowns
│   │   ├── layout/             # Sidebars & navigation
│   │   └── documents/          # Printable A4 templates (Invoice, Form-C)
│   ├── db/                     # NeonDB + Drizzle ORM
│   │   ├── index.ts
│   │   ├── schema.ts
│   │   ├── seed.ts
│   │   └── data/banks.json
│   ├── lib/
│   │   └── pdfParser.ts        # Spatial coordinate MT103 PDF parser
│   └── types/
│       └── index.ts            # Consolidated TypeScript types
├── package.json
└── tsconfig.json
```

---

## 📄 License

MIT
