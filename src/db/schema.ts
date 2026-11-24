import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const clients = pgTable("clients", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  tax_id: text("tax_id"),
  bank_name: text("bank_name"),
  bank_address: text("bank_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const paymentAccounts = pgTable("payment_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  bank_name: text("bank_name").notNull(),
  bank_address: text("bank_address"),
  name_on_account: text("name_on_account").notNull(),
  bic_swift: text("bic_swift"),
  account_number: text("account_number").notNull(),
  account_name: text("account_name"),
  account_details: text("account_details"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    client_id: uuid("client_id").references(() => clients.id, {
      onDelete: "cascade",
    }),
    invoice_number: text("invoice_number").notNull().unique(),
    invoice_date: date("invoice_date"),
    currency: text("currency").default("USD"),
    amount: numeric("amount"),
    description: text("description"),
    received_amount: numeric("received_amount"),
    payment_methods: jsonb("payment_methods"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    clientIdx: index("idx_invoices_client_id").on(table.client_id),
    dateIdx: index("idx_invoices_invoice_date").on(table.invoice_date),
  }),
);

export const vendors = pgTable(
  "vendors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    receiver_name: text("receiver_name").notNull(),
    account_number: text("account_number").notNull(),
    bank_name: text("bank_name").notNull(),
    branch_name: text("branch_name").notNull(),
    routing_number: text("routing_number").notNull(),
    is_employee: boolean("is_employee").default(false),
    is_hidden: boolean("is_hidden").default(false),
    salary: numeric("salary").default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    nameIdx: index("idx_vendors_receiver_name").on(table.receiver_name),
  }),
);

export const debitAccounts = pgTable(
  "debit_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    account_number: text("account_number").notNull(),
    account_label: text("account_label").default("Main SCB Account"),
    bank_name: text("bank_name").default("Standard Chartered Bank"),
    is_default: boolean("is_default").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("debit_accounts_one_default")
      .on(table.is_default)
      .where(sql`${table.is_default} IS TRUE`),
  ],
);

export const bankBranches = pgTable("bank_branches", {
  id: uuid("id").defaultRandom().primaryKey(),
  bank_code: text("bank_code"),
  bank_name: text("bank_name").notNull(),
  district_code: text("district_code"),
  district_name: text("district_name"),
  branch_code: text("branch_code"),
  branch_name: text("branch_name").notNull(),
  routing_number: text("routing_number").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const mcpAccessTokens = pgTable(
  "mcp_access_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    prefix: text("prefix").notNull(),
    readOnly: boolean("read_only").default(false).notNull(),
    allowedScopes: jsonb("allowed_scopes")
      .$type<string[]>()
      .default(["*"])
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tokenHashIdx: index("idx_mcp_access_tokens_token_hash").on(table.tokenHash),
    statusIdx: index("idx_mcp_access_tokens_status").on(
      table.revokedAt,
      table.expiresAt,
    ),
  }),
);

export const mcpRuns = pgTable(
  "mcp_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tokenId: uuid("token_id").references(() => mcpAccessTokens.id, {
      onDelete: "cascade",
    }),
    toolName: text("tool_name").notNull(),
    requestId: text("request_id"),
    requestHash: text("request_hash"),
    status: text("status").notNull(), // "completed" | "failed" | "running"
    input: jsonb("input"),
    result: jsonb("result"),
    error: text("error"),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tokenIdIdx: index("idx_mcp_runs_token_id").on(table.tokenId),
    createdAtIdx: index("idx_mcp_runs_created_at").on(table.createdAt),
    toolNameIdx: index("idx_mcp_runs_tool_name").on(table.toolName),
  }),
);

export const mcpLimits = pgTable(
  "mcp_limits",
  {
    id: text("id").primaryKey(), // `${tokenId}:${windowTimestamp}`
    tokenId: uuid("token_id").notNull(),
    count: integer("count").default(1).notNull(),
    window: timestamp("window", { withTimezone: true }).notNull(),
  },
  (table) => ({
    windowIdx: index("idx_mcp_limits_window").on(table.window),
  }),
);

export const mcpWriteRequests = pgTable(
  "mcp_write_requests",
  {
    tokenId: uuid("token_id")
      .notNull()
      .references(() => mcpAccessTokens.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    completed: boolean("completed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.tokenId, table.key] })],
);
