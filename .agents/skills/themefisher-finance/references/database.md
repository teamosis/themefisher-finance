# Database Schema & Operations

The application uses **NeonDB** (serverless PostgreSQL) via the `@neondatabase/serverless` HTTP driver and **Drizzle ORM**.

---

## 1. Schema Tables (`src/db/schema.ts`)

### `clients`
Foreign companies issuing payments to Themefisher.
- `id` (UUID, PK, default random)
- `name` (TEXT, NOT NULL)
- `address` (TEXT)
- `tax_id` (TEXT)
- `bank_name` (TEXT)
- `bank_address` (TEXT)
- `created_at` (TIMESTAMP WITH TIME ZONE)

### `invoices`
Invoices issued for inward remittances.
- `id` (UUID, PK, default random)
- `client_id` (UUID, FK -> clients.id ON DELETE CASCADE)
- `invoice_number` (TEXT, UNIQUE, NOT NULL)
- `invoice_date` (DATE)
- `currency` (TEXT, default 'USD')
- `amount` (NUMERIC)
- `description` (TEXT)
- `received_amount` (NUMERIC)
- `payment_methods` (JSONB)
- `created_at` (TIMESTAMP WITH TIME ZONE)
- *Indexes:* `idx_invoices_client_id`, `idx_invoices_invoice_date`

### `payment_accounts`
Themefisher's receiving bank accounts.
- `id` (UUID, PK, default random)
- `bank_name` (TEXT, NOT NULL)
- `bank_address` (TEXT)
- `name_on_account` (TEXT, NOT NULL)
- `bic_swift` (TEXT)
- `account_number` (TEXT, NOT NULL)
- `account_name` (TEXT)
- `account_details` (TEXT)
- `created_at` (TIMESTAMP WITH TIME ZONE)

### `vendors`
Beneficiaries and team members for SCB bulk transactions.
- `id` (UUID, PK, default random)
- `receiver_name` (TEXT, NOT NULL)
- `account_number` (TEXT, NOT NULL)
- `bank_name` (TEXT, NOT NULL)
- `branch_name` (TEXT, NOT NULL)
- `routing_number` (TEXT, NOT NULL)
- `is_employee` (BOOLEAN, default false)
- `salary` (NUMERIC, default 0)
- `is_hidden` (BOOLEAN, default false)
- `created_at` (TIMESTAMP WITH TIME ZONE)
- *Indexes:* `idx_vendors_receiver_name`

### `debit_accounts`
Standard Chartered Bank debit funding accounts.
- `id` (UUID, PK, default random)
- `account_number` (TEXT, NOT NULL)
- `account_label` (TEXT, default 'Main SCB Account')
- `bank_name` (TEXT, default 'Standard Chartered Bank')
- `is_default` (BOOLEAN, default true)
- `created_at` (TIMESTAMP WITH TIME ZONE)

### `bank_branches`
Complete Bangladesh Bank branch routing dataset (11,426 records).
- `id` (UUID, PK, default random)
- `bank_code` (TEXT)
- `bank_name` (TEXT, NOT NULL)
- `district_code` (TEXT)
- `district_name` (TEXT)
- `branch_code` (TEXT)
- `branch_name` (TEXT, NOT NULL)
- `routing_number` (TEXT, UNIQUE, NOT NULL)
- `created_at` (TIMESTAMP WITH TIME ZONE)

---

## 2. Database Commands

```bash
# Push schema changes directly to NeonDB
npm run db:push

# Generate Drizzle migrations
npm run db:generate

# Execute Drizzle migrations
npm run db:migrate

# Seed database with initial accounts, clients, team members, and all 11,426 bank branches
npm run db:seed

# Open Drizzle Studio visual browser
npm run db:studio
```

---

## 3. Database Seeding (`src/db/seed.ts`)

The seed script is fully idempotent (`onConflictDoNothing` and count checks):
1. **Debit Accounts:** Inserts default SCB account from `$NEXT_PUBLIC_SCB_DEBIT_ACCOUNT` (fallback `0001914137101`).
2. **Payment Accounts:** Inserts Themefisher's official SCB inward receiving account.
3. **Clients:** Inserts Envato Pty Ltd, Stripe Payments Europe Ltd, and FastSpring.
4. **Vendors:** Inserts team employees with salaries and SCB/BRAC/City Bank accounts.
5. **Bank Branches:** Batch-inserts 11,426 branches from `src/db/data/banks.json` in chunks of 500 rows.
