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

Fill in your NeonDB and SCB configuration:
```env
DATABASE_URL=postgresql://user:password@host.tld/dbname?sslmode=require
NEXT_PUBLIC_SCB_DEBIT_ACCOUNT=0001914137101
```

### 2. Setup Database & Seed
Push the Drizzle schema to your Neon PostgreSQL database and seed initial data:
```bash
pnpm db:push
pnpm db:seed
```

### 3. Run Locally
```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

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
