# Business Rules & Financial Workflows

This document outlines the domain rules and procedures implemented across the application.

---

## 1. Invoice & Inward Remittance Tools (`/invoice-tools`)

### Invoice Number Convention

- **Format:** `TF-YYYY-MM-DD-XX` (e.g. `TF-2026-09-15-01`).
- **Uniqueness:** Guaranteed at the database level (`UNIQUE` constraint on `invoices.invoice_number`).
- **Default Description:** Pre-filled with `"Web development services"` (editable by user).

### Bangladesh Bank Form-C Declaration

- Official declaration under the Foreign Exchange Regulation Act for inward remittances (ICT software & web export services).
- Printed on A4 paper using `@media print` styles and `react-to-print`.
- **Date Rule:** The date displayed on Form-C represents the date of document generation/submission (current date), not the invoice date.
- **Remitted Amount:** Defaults to the invoice amount. If a custom remitted amount is entered (e.g. after deduction of intermediary bank fees), that specific value is displayed.

### Bank Invoice Template

- Formatted with remitter and beneficiary details, bank addresses, BIC/SWIFT code, and account numbers.
- **Sales Period:** Automatically computed as the first day to the last day of the invoice's month (`d-MMM-yyyy`).

### MT103 Remittance PDF Spatial Parsing (`src/lib/pdfParser.ts`)

- Users can upload password-protected bank remittance advice PDFs.
- **Password:** The operator enters it for protected PDFs.
- **Parsing Engine:** Deterministic spatial coordinate extraction using `pdfjs-dist`:
  - Locates "Ordering Customer" and "Details" columns using X/Y coordinates.
  - Resolves client names, amounts, value dates, and BIC/SWIFT codes without external LLM latency.
  - **Invoice Date Computation:** Value Date from PDF minus 7 days.
  - **Client Matching:** 3-pass algorithm (exact match → word-level fuzzy match ignoring noise words like "Ltd", "Inc", "Co", "Private" → full-text fallback).

---

## 2. SCB Bulk Transaction Tools (`/scb-tools`)

### SCB Straight2Bank Bulk Excel Export

- Generates `.xlsx` spreadsheets matching Standard Chartered Bank Straight2Bank bulk upload specifications.
- Columns include: Customer Reference, Debit Account Number, Value Date, Beneficiary Name, Beneficiary Account, Beneficiary Bank, Branch, Routing Number, Amount, Currency (BDT).

### Bank Branch Routing Numbers

- Sourced from 11,426 official Bangladesh Bank BEFTN records.
- User selects Bank Name -> filtered dynamic dropdown of branches -> auto-fills 9-digit routing number.
- Supports manual override / custom bank entry via `react-select/creatable`.

### Salary Sheet Generator

- Triggered via the **"Create Salary Sheet"** modal on the SCB Tools dashboard.
- Filters vendors by `is_employee: true`.
- Allows reviewing and adjusting default monthly salaries.
- Supports **Additional Transactions** (bonuses, allowances, external vendor payments).
- Real-time live total calculation: `Employees Subtotal + Additional Subtotal = Grand Total`.
- Supports one-click direct Excel export or loading into the main generator batch table.

### Vendor Archiving vs Deleting

- Vendors can be marked as `is_hidden: true` instead of permanently destroying history.
- Tabs on the Vendors page allow viewing `All`, `Employees`, `Others`, and `Hidden` accounts.
