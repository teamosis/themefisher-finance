import { lookupSwiftCode } from "@/actions/banks";
import { db } from "@/db";
import { assignDefaultDebitAccount } from "@/db/debit-accounts";
import {
  activityLogs,
  bankBranches,
  clients,
  debitAccounts,
  invoices,
  paymentAccounts,
  paymentRequests,
  vendors,
} from "@/db/schema";
import {
  invoiceAmount,
  invoiceCurrency,
  invoiceDate,
  invoicePaymentMethods,
} from "@/lib/invoice-validation";
import { insertInvoice } from "@/lib/create-invoice";
import { paymentRequestReview } from "@/lib/payment-request-operations";
import { verifyPaymentRequest } from "@/lib/payment-request-verification";
import { and, asc, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { McpScopeKey } from "./scopes";

import { beforePage, finishPage, pageCursor, pageTimestamp } from "./pagination";
import { defineTool, McpToolError, type McpToolDefinition } from "./tool-definition";
import { workflowTools } from "./workflow-tools";
import { getMcpOrigin } from "./token-service";

function allowsScope(scopes: readonly string[], scope: McpScopeKey) {
  return scopes.includes("*") || scopes.includes(scope);
}

function vendorForScopes<T extends { salary: unknown }>(
  vendor: T,
  scopes: readonly string[],
) {
  if (allowsScope(scopes, "payroll")) return vendor;
  const { salary: _salary, ...publicFields } = vendor;
  return publicFields;
}

async function matchingClients(name: string) {
  const lowerName = name.toLowerCase();
  const rows = await db.select().from(clients)
    .where(sql`strpos(lower(${clients.name}), ${lowerName}) > 0`)
    .orderBy(sql`(lower(${clients.name}) = ${lowerName}) DESC`, asc(clients.name), asc(clients.id))
    .limit(21);
  const exact = rows.filter((row) => row.name.toLowerCase() === lowerName);
  return exact.length ? exact : rows;
}

function ambiguousClients(rows: (typeof clients.$inferSelect)[]) {
  return {
    status: "ambiguous",
    candidates: rows.slice(0, 20).map(({ id, name, address }) => ({ id, name, address })),
    hasMore: rows.length > 20,
  };
}

export const tools: McpToolDefinition[] = [
  // =========================================================================
  // SYSTEM / OVERVIEW
  // =========================================================================
  defineTool({
    name: "finance_get_overview",
    scope: "system",
    description:
      "Confirm connectivity and return financial summaries for the domains permitted by the token.",
    write: false,
    schema: z.object({}),
    handler: async (_args, scopes = []) => {
      const allows = (scope: McpScopeKey) =>
        scopes.includes("*") || scopes.includes(scope);
      const [invoiceStats] = allows("invoices")
        ? await db
            .select({
              totalCount: sql<number>`count(*)::int`,
              totalAmount: sql<string>`coalesce(sum(amount), 0)::text`,
              totalReceived: sql<string>`coalesce(sum(received_amount), 0)::text`,
            })
            .from(invoices)
        : [];

      const [clientStats] = allows("clients")
        ? await db.select({ count: sql<number>`count(*)::int` }).from(clients)
        : [];

      const [employeeStats] = allows("payroll")
        ? await db
            .select({
              headcount: sql<number>`count(*)::int`,
              monthlyPayrollBdt: sql<string>`coalesce(sum(salary), 0)::text`,
            })
            .from(vendors)
            .where(
              and(
                eq(vendors.is_employee, true),
                or(
                  eq(vendors.is_hidden, false),
                  sql`${vendors.is_hidden} is null`,
                ),
              ),
            )
        : [];

      const [defaultDebit] = allows("accounts")
        ? await db
            .select({
              accountNumber: debitAccounts.account_number,
              accountLabel: debitAccounts.account_label,
              bankName: debitAccounts.bank_name,
            })
            .from(debitAccounts)
            .where(eq(debitAccounts.is_default, true))
            .limit(1)
        : [];

      const [logsStats] = scopes.includes("logs")
        ? await db
            .select({
              totalCount: sql<number>`count(*)::int`,
              excelExportsCount: sql<number>`count(*) filter (where ${activityLogs.action} in ('excel_export_transfers', 'excel_export_salary'))::int`,
              totalDisbursedBdt: sql<string>`coalesce(sum(case when ${activityLogs.action} in ('excel_export_transfers', 'excel_export_salary') then (${activityLogs.details}->>'totalAmount')::numeric else 0 end), 0)::text`,
            })
            .from(activityLogs)
        : [];

      return {
        connected: true,
        ...(allows("invoices") && {
          invoices: {
            totalCount: Number(invoiceStats?.totalCount ?? 0),
            totalAmountUsd: Number(invoiceStats?.totalAmount ?? 0),
            totalReceivedUsd: Number(invoiceStats?.totalReceived ?? 0),
          },
        }),
        ...(allows("clients") && {
          clients: {
            totalActive: Number(clientStats?.count ?? 0),
          },
        }),
        ...(allows("payroll") && {
          payroll: {
            activeEmployeeCount: Number(employeeStats?.headcount ?? 0),
            totalMonthlySalaryBdt: Number(
              employeeStats?.monthlyPayrollBdt ?? 0,
            ),
          },
        }),
        ...(allows("accounts") && {
          defaultScbDebitAccount: defaultDebit ?? null,
        }),
        ...(scopes.includes("logs") && {
          activityLogs: {
            totalCount: Number(logsStats?.totalCount ?? 0),
            excelExportsCount: Number(logsStats?.excelExportsCount ?? 0),
            totalDisbursedBdt: Number(logsStats?.totalDisbursedBdt ?? 0),
          },
        }),
      };
    },
  }),

  // =========================================================================
  // INVOICES & REMITTANCES
  // =========================================================================
  defineTool({
    name: "finance_invoices_list",
    scope: "invoices",
    description:
      "List inward remittance invoices with optional search, client filter, date ordering, and pagination.",
    write: false,
    schema: z.object({
      search: z
        .string()
        .optional()
        .describe("Search term matched against invoice number or description"),
      clientId: z
        .string()
        .uuid()
        .optional()
        .describe("Filter invoices by specific client UUID"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(30)
        .describe("Maximum number of invoices to return (default: 30)"),
      offset: z
        .number()
        .int()
        .min(0)
        .default(0)
        .describe("Number of invoices to skip (default: 0)"),
    }),
    handler: async ({ search, clientId, limit, offset }) => {
      const conditions = [];
      if (search?.trim()) {
        conditions.push(
          or(
            ilike(invoices.invoice_number, `%${search.trim()}%`),
            ilike(invoices.description, `%${search.trim()}%`),
          ),
        );
      }
      if (clientId) {
        conditions.push(eq(invoices.client_id, clientId));
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      const [items, totalResult] = await Promise.all([
        db
          .select({
            id: invoices.id,
            clientId: invoices.client_id,
            clientName: clients.name,
            invoiceNumber: invoices.invoice_number,
            invoiceDate: invoices.invoice_date,
            currency: invoices.currency,
            amount: invoices.amount,
            receivedAmount: invoices.received_amount,
            description: invoices.description,
            paymentMethods: invoices.payment_methods,
            createdAt: invoices.createdAt,
          })
          .from(invoices)
          .leftJoin(clients, eq(invoices.client_id, clients.id))
          .where(whereClause)
          .orderBy(desc(invoices.invoice_date), desc(invoices.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(invoices)
          .where(whereClause),
      ]);

      const total = Number(totalResult[0]?.count ?? 0);
      return {
        items,
        total,
        limit,
        offset,
        hasMore: offset + items.length < total,
      };
    },
  }),
  defineTool({
    name: "finance_invoices_get",
    scope: "invoices",
    description:
      "Get complete invoice and inward remittance details by either invoice ID or invoice number (e.g. 'TF-2026-03-15-01').",
    write: false,
    schema: z.object({
      id: z
        .string()
        .optional()
        .describe("Invoice UUID (provide id OR invoiceNumber)"),
      invoiceNumber: z
        .string()
        .optional()
        .describe(
          "Invoice number in format 'TF-YYYY-MM-DD-XX' (e.g. 'TF-2026-03-15-01')",
        ),
    }),
    handler: async ({ id, invoiceNumber }) => {
      if (!id && !invoiceNumber) {
        throw new Error("Must provide either 'id' or 'invoiceNumber'");
      }

      const condition = id
        ? eq(invoices.id, id)
        : eq(invoices.invoice_number, invoiceNumber!);

      const [invoice] = await db
        .select({
          id: invoices.id,
          clientId: invoices.client_id,
          clientName: clients.name,
          clientAddress: clients.address,
          clientTaxId: clients.tax_id,
          clientBankName: clients.bank_name,
          clientBankAddress: clients.bank_address,
          invoiceNumber: invoices.invoice_number,
          invoiceDate: invoices.invoice_date,
          currency: invoices.currency,
          amount: invoices.amount,
          receivedAmount: invoices.received_amount,
          description: invoices.description,
          paymentMethods: invoices.payment_methods,
          createdAt: invoices.createdAt,
        })
        .from(invoices)
        .leftJoin(clients, eq(invoices.client_id, clients.id))
        .where(condition)
        .limit(1);

      if (!invoice) throw new Error("Invoice not found");
      const printUrl = new URL("/invoice-tools", getMcpOrigin());
      printUrl.searchParams.set("invoiceId", invoice.id);
      return { ...invoice, printUrl: printUrl.href };
    },
  }),
  defineTool({
    name: "finance_invoices_create",
    scope: "invoices",
    description:
      "Create an inward remittance invoice by client UUID or name. Omit invoiceNumber and provide an idempotencyKey to allocate the next number for the date. Client name lookup requires clients scope.",
    write: true,
    requireIdempotency: ({ invoiceNumber }) => !invoiceNumber,
    schema: z.object({
      clientId: z.uuid().optional().describe("Client UUID receiving the invoice"),
      clientName: z.string().trim().min(1).max(200).optional().describe("Client name if the UUID is unknown"),
      invoiceNumber: z
        .string()
        .trim()
        .min(5)
        .optional()
        .describe("Unique invoice number, e.g. 'TF-2026-11-24-01'"),
      invoiceDate: invoiceDate.describe(
        "Invoice date formatted as 'YYYY-MM-DD'",
      ),
      currency: invoiceCurrency
        .default("USD")
        .describe("Currency code (default: 'USD')"),
      amount: invoiceAmount.describe("Billed amount (e.g. 5000.00)"),
      receivedAmount: invoiceAmount
        .optional()
        .describe("Net remittance amount received in bank (e.g. 4985.00)"),
      description: z
        .string()
        .describe(
          "Description of services (e.g. 'Software development & UI theme licenses')",
        ),
      paymentMethods: invoicePaymentMethods
        .default(["Wire Transfer", "Bank Remittance"])
        .describe("Allowed payment methods list"),
    }).refine(({ clientId, clientName }) => Boolean(clientId) !== Boolean(clientName), "Provide exactly one of clientId or clientName"),
    handler: async (input, scopes = []) => {
      let clientId = input.clientId;
      if (!clientId && input.clientName) {
        if (!allowsScope(scopes, "clients")) {
          throw new McpToolError("Client name lookup requires clients scope. Provide a client UUID or use a token with clients scope.", undefined, true);
        }
        const matches = await matchingClients(input.clientName);
        if (!matches.length) throw new McpToolError("No matching client. Use finance_clients_list or create a client first.", undefined, true);
        if (matches.length > 1) throw new McpToolError("Multiple clients match. Choose a candidate and pass its UUID.", ambiguousClients(matches), true);
        clientId = matches[0].id;
      }
      const invoice = await insertInvoice({
        client_id: clientId,
        invoice_number: input.invoiceNumber,
        invoice_date: input.invoiceDate,
        currency: input.currency,
        amount: input.amount,
        received_amount: input.receivedAmount ?? input.amount,
        description: input.description,
        payment_methods: input.paymentMethods,
      });
      return { success: true, invoice };
    },
  }),
  defineTool({
    name: "finance_invoices_update",
    scope: "invoices",
    description:
      "Update an existing invoice's amounts, date, or details by invoice ID.",
    write: true,
    schema: z.object({
      id: z.string().uuid().describe("Invoice UUID to update"),
      invoiceDate: invoiceDate.optional(),
      amount: invoiceAmount.optional(),
      receivedAmount: invoiceAmount.optional(),
      description: z.string().optional(),
      paymentMethods: invoicePaymentMethods.optional(),
    }),
    handler: async ({ id, ...updates }) => {
      const updateData: Record<string, unknown> = {};
      if (updates.invoiceDate !== undefined)
        updateData.invoice_date = updates.invoiceDate;
      if (updates.amount !== undefined)
        updateData.amount = updates.amount.toString();
      if (updates.receivedAmount !== undefined)
        updateData.received_amount = updates.receivedAmount.toString();
      if (updates.description !== undefined)
        updateData.description = updates.description;
      if (updates.paymentMethods !== undefined)
        updateData.payment_methods = updates.paymentMethods;

      const [updated] = await db
        .update(invoices)
        .set(updateData)
        .where(eq(invoices.id, id))
        .returning();

      if (!updated) throw new Error("Invoice not found or no changes made");
      return { success: true, invoice: updated };
    },
  }),
  defineTool({
    name: "finance_invoices_delete",
    scope: "invoices",
    description: "Delete an invoice permanently by its UUID.",
    write: true,
    schema: z.object({
      id: z.string().uuid().describe("Invoice UUID to delete"),
    }),
    handler: async ({ id }) => {
      const [deleted] = await db
        .delete(invoices)
        .where(eq(invoices.id, id))
        .returning({ id: invoices.id, invoiceNumber: invoices.invoice_number });
      if (!deleted) throw new Error("Invoice not found");
      return { success: true, deleted };
    },
  }),

  // =========================================================================
  // CLIENTS
  // =========================================================================
  defineTool({
    name: "finance_clients_list",
    scope: "clients",
    description:
      "List all international clients with optional search by client name.",
    write: false,
    schema: z.object({
      search: z
        .string()
        .optional()
        .describe("Search term matched against client name"),
    }),
    handler: async ({ search }) => {
      const whereClause = search?.trim()
        ? ilike(clients.name, `%${search.trim()}%`)
        : undefined;

      const items = await db
        .select()
        .from(clients)
        .where(whereClause)
        .orderBy(asc(clients.name));

      return { items, count: items.length };
    },
  }),
  defineTool({
    name: "finance_clients_get",
    scope: "clients",
    description:
      "Get a client profile by ID or name. Multiple matching names return candidates.",
    write: false,
    schema: z.object({
      id: z.string().uuid().optional().describe("Client UUID"),
      name: z.string().trim().min(1).max(200).optional().describe("Exact or partial client name"),
    }),
    handler: async ({ id, name }) => {
      if (id) {
        const [client] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
        if (!client) throw new McpToolError("Client not found.");
        return client;
      }
      if (!name) throw new McpToolError("Provide either id or name.");
      const matches = await matchingClients(name);
      if (!matches.length) throw new McpToolError("Client not found.");
      return matches.length === 1 ? matches[0] : ambiguousClients(matches);
    },
  }),
  defineTool({
    name: "finance_clients_create",
    scope: "clients",
    description:
      "Register a new international client with foreign address and remittance bank information.",
    write: true,
    schema: z.object({
      name: z.string().min(1).describe("Client company or individual name"),
      address: z
        .string()
        .optional()
        .describe("Full physical street/city/country address"),
      taxId: z
        .string()
        .optional()
        .describe("Client Tax ID / VAT / Registration number"),
      bankName: z
        .string()
        .optional()
        .describe("Remitting bank name (e.g. 'JPMorgan Chase Bank')"),
      bankAddress: z
        .string()
        .optional()
        .describe("Remitting bank branch address"),
    }),
    handler: async (input) => {
      const [created] = await db
        .insert(clients)
        .values({
          name: input.name.trim(),
          address: input.address,
          tax_id: input.taxId,
          bank_name: input.bankName,
          bank_address: input.bankAddress,
        })
        .returning();
      return { success: true, client: created };
    },
  }),
  defineTool({
    name: "finance_clients_update",
    scope: "clients",
    description:
      "Update client name, address, tax ID, or bank details by client ID.",
    write: true,
    schema: z.object({
      id: z.string().uuid().describe("Client UUID to update"),
      name: z.string().optional(),
      address: z.string().optional(),
      taxId: z.string().optional(),
      bankName: z.string().optional(),
      bankAddress: z.string().optional(),
    }),
    handler: async ({ id, ...updates }) => {
      const updateData: Record<string, unknown> = {};
      if (updates.name !== undefined) updateData.name = updates.name.trim();
      if (updates.address !== undefined) updateData.address = updates.address;
      if (updates.taxId !== undefined) updateData.tax_id = updates.taxId;
      if (updates.bankName !== undefined)
        updateData.bank_name = updates.bankName;
      if (updates.bankAddress !== undefined)
        updateData.bank_address = updates.bankAddress;

      const [updated] = await db
        .update(clients)
        .set(updateData)
        .where(eq(clients.id, id))
        .returning();

      if (!updated) throw new Error("Client not found");
      return { success: true, client: updated };
    },
  }),
  defineTool({
    name: "finance_clients_delete",
    scope: "clients",
    description:
      "Delete a client profile with no linked invoices by client ID.",
    write: true,
    schema: z.object({
      id: z.string().uuid().describe("Client UUID to delete"),
    }),
    handler: async ({ id }) => {
      const [deleted] = await db
        .delete(clients)
        .where(eq(clients.id, id))
        .returning();
      if (!deleted) throw new Error("Client not found");
      return { success: true, deleted };
    },
  }),

  // =========================================================================
  // VENDORS & BENEFICIARIES
  // =========================================================================
  defineTool({
    name: "finance_vendors_list",
    scope: "vendors",
    description:
      "List vendors and employees with bank accounts and routing numbers. Can filter for staff only or search by receiver name.",
    write: false,
    schema: z.object({
      isEmployee: z
        .boolean()
        .optional()
        .describe(
          "Filter: true for staff on payroll, false for vendor/contractor",
        ),
      includeHidden: z
        .boolean()
        .default(false)
        .describe("Include archived/hidden beneficiaries (default: false)"),
      search: z
        .string()
        .optional()
        .describe("Search term matched against beneficiary receiver name"),
    }),
    handler: async ({ isEmployee, includeHidden, search }, scopes = []) => {
      const conditions = [];
      if (!includeHidden) {
        conditions.push(
          or(eq(vendors.is_hidden, false), sql`${vendors.is_hidden} is null`),
        );
      }
      if (isEmployee !== undefined) {
        conditions.push(eq(vendors.is_employee, isEmployee));
      }
      if (search?.trim()) {
        conditions.push(ilike(vendors.receiver_name, `%${search.trim()}%`));
      }

      const items = await db
        .select()
        .from(vendors)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(asc(vendors.receiver_name));

      return {
        items: items.map((item) => vendorForScopes(item, scopes)),
        count: items.length,
      };
    },
  }),
  defineTool({
    name: "finance_vendors_get",
    scope: "vendors",
    description: "Get beneficiary details by vendor ID.",
    write: false,
    schema: z.object({
      id: z.string().uuid().describe("Vendor UUID"),
    }),
    handler: async ({ id }, scopes = []) => {
      const [vendor] = await db
        .select()
        .from(vendors)
        .where(eq(vendors.id, id))
        .limit(1);
      if (!vendor) throw new Error("Beneficiary not found");
      return vendorForScopes(vendor, scopes);
    },
  }),
  defineTool({
    name: "finance_vendors_create",
    scope: "vendors",
    description:
      "Add a new beneficiary or payroll employee with bank account, branch, and 9-digit routing number.",
    write: true,
    schema: z.object({
      receiverName: z
        .string()
        .min(1)
        .describe("Beneficiary full name on bank account"),
      accountNumber: z.string().min(5).describe("Bank account number"),
      bankName: z
        .string()
        .min(1)
        .describe("Bank name (e.g. 'Dutch-Bangla Bank PLC')"),
      branchName: z
        .string()
        .min(1)
        .describe("Branch name (e.g. 'Dhanmondi Branch')"),
      routingNumber: z
        .string()
        .length(9)
        .describe("9-digit Bangladesh bank routing code"),
      isEmployee: z
        .boolean()
        .default(false)
        .describe("Set to true for monthly salary payroll"),
      salary: z
        .number()
        .min(0)
        .default(0)
        .describe("Monthly salary amount in BDT"),
    }),
    handler: async (input, scopes = []) => {
      if (
        (input.isEmployee || input.salary > 0) &&
        !allowsScope(scopes, "payroll")
      ) {
        throw new Error(
          "Payroll scope is required to set employment or salary.",
        );
      }
      const [created] = await db
        .insert(vendors)
        .values({
          receiver_name: input.receiverName.trim(),
          account_number: input.accountNumber.trim(),
          bank_name: input.bankName.trim(),
          branch_name: input.branchName.trim(),
          routing_number: input.routingNumber.trim(),
          is_employee: input.isEmployee,
          salary: input.salary.toString(),
          is_hidden: false,
        })
        .returning();
      return { success: true, vendor: vendorForScopes(created, scopes) };
    },
  }),
  defineTool({
    name: "finance_vendors_update",
    scope: "vendors",
    description:
      "Update beneficiary bank account details, routing number, or salary by ID.",
    write: true,
    schema: z.object({
      id: z.string().uuid().describe("Vendor UUID to update"),
      receiverName: z.string().optional(),
      accountNumber: z.string().optional(),
      bankName: z.string().optional(),
      branchName: z.string().optional(),
      routingNumber: z.string().length(9).optional(),
      isEmployee: z.boolean().optional(),
      salary: z.number().min(0).optional(),
      isHidden: z.boolean().optional(),
    }),
    handler: async ({ id, ...updates }, scopes = []) => {
      if (
        (updates.isEmployee !== undefined || updates.salary !== undefined) &&
        !allowsScope(scopes, "payroll")
      ) {
        throw new Error(
          "Payroll scope is required to change employment or salary.",
        );
      }
      const updateData: Record<string, unknown> = {};
      if (updates.receiverName !== undefined)
        updateData.receiver_name = updates.receiverName.trim();
      if (updates.accountNumber !== undefined)
        updateData.account_number = updates.accountNumber.trim();
      if (updates.bankName !== undefined)
        updateData.bank_name = updates.bankName.trim();
      if (updates.branchName !== undefined)
        updateData.branch_name = updates.branchName.trim();
      if (updates.routingNumber !== undefined)
        updateData.routing_number = updates.routingNumber.trim();
      if (updates.isEmployee !== undefined)
        updateData.is_employee = updates.isEmployee;
      if (updates.salary !== undefined)
        updateData.salary = updates.salary.toString();
      if (updates.isHidden !== undefined)
        updateData.is_hidden = updates.isHidden;

      const [updated] = await db
        .update(vendors)
        .set(updateData)
        .where(eq(vendors.id, id))
        .returning();

      if (!updated) throw new Error("Beneficiary not found");
      return { success: true, vendor: vendorForScopes(updated, scopes) };
    },
  }),
  defineTool({
    name: "finance_vendors_delete",
    scope: "vendors",
    description: "Delete a beneficiary by ID permanently.",
    write: true,
    schema: z.object({
      id: z.string().uuid().describe("Vendor UUID to delete"),
    }),
    handler: async ({ id }, scopes = []) => {
      const [deleted] = await db
        .delete(vendors)
        .where(eq(vendors.id, id))
        .returning();
      if (!deleted) throw new Error("Beneficiary not found");
      return { success: true, deleted: vendorForScopes(deleted, scopes) };
    },
  }),

  // =========================================================================
  // PAYROLL & SALARIES
  // =========================================================================
  defineTool({
    name: "finance_payroll_get_salary_sheet",
    scope: "payroll",
    description:
      "Generate complete employee salary payroll summary for SCB bulk transaction export, listing all active employees, individual salaries in BDT, and total company monthly payroll budget.",
    write: false,
    schema: z.object({}),
    handler: async () => {
      const employees = await db
        .select({
          id: vendors.id,
          name: vendors.receiver_name,
          accountNumber: vendors.account_number,
          bankName: vendors.bank_name,
          branchName: vendors.branch_name,
          routingNumber: vendors.routing_number,
          salary: vendors.salary,
        })
        .from(vendors)
        .where(
          and(
            eq(vendors.is_employee, true),
            or(eq(vendors.is_hidden, false), sql`${vendors.is_hidden} is null`),
          ),
        )
        .orderBy(asc(vendors.receiver_name));

      const totalPayrollBdt = employees.reduce((sum, emp) => {
        return sum + Number(emp.salary ?? 0);
      }, 0);

      return {
        employeeCount: employees.length,
        totalPayrollBdt,
        employees: employees.map((emp) => ({
          ...emp,
          salaryBdt: Number(emp.salary ?? 0),
        })),
      };
    },
  }),

  // =========================================================================
  // BANKING & BRANCH ROUTING (11,426 BANGLADESH BRANCHES)
  // =========================================================================
  defineTool({
    name: "finance_banks_get_names",
    scope: "banking",
    description:
      "List all supported banks across Bangladesh from the branch directory.",
    write: false,
    schema: z.object({}),
    handler: async () => {
      const data = await db
        .selectDistinct({ bankName: bankBranches.bank_name })
        .from(bankBranches)
        .orderBy(asc(bankBranches.bank_name));
      return { banks: data.map((d) => d.bankName) };
    },
  }),
  defineTool({
    name: "finance_banks_get_branches",
    scope: "banking",
    description:
      "Get all branch names and district locations for a specified bank name.",
    write: false,
    schema: z.object({
      bankName: z
        .string()
        .min(1)
        .describe(
          "Exact bank name, e.g. 'Standard Chartered Bank' or 'Dutch-Bangla Bank PLC'",
        ),
    }),
    handler: async ({ bankName }) => {
      const branches = await db
        .select({
          branchName: bankBranches.branch_name,
          districtName: bankBranches.district_name,
          routingNumber: bankBranches.routing_number,
        })
        .from(bankBranches)
        .where(eq(bankBranches.bank_name, bankName.trim()))
        .orderBy(asc(bankBranches.branch_name));

      return {
        bankName,
        count: branches.length,
        branches,
      };
    },
  }),
  defineTool({
    name: "finance_banks_lookup_routing",
    scope: "banking",
    description: "Resolve a Bangladesh Bank routing number by code or by bank and branch name. Matches ignore case and return branch candidates when ambiguous. District can narrow the search.",
    write: false,
    schema: z.object({
      routingNumber: z.string().trim().regex(/^\d{9}$/).optional(),
      bankName: z.string().trim().min(1).max(150).optional(),
      branchName: z.string().trim().min(1).max(150).optional(),
      districtName: z.string().trim().min(1).max(150).optional(),
    }).refine(({ routingNumber, bankName, branchName }) => Boolean(routingNumber || (bankName && branchName)), "Provide a routing number or both bank and branch names"),
    handler: async ({ bankName, branchName, districtName, routingNumber }) => {
      const bank = bankName?.toLowerCase();
      const branch = branchName?.toLowerCase();
      const district = districtName?.toLowerCase();
      const rows = await db.select({
        bankName: bankBranches.bank_name,
        branchName: bankBranches.branch_name,
        districtName: bankBranches.district_name,
        routingNumber: bankBranches.routing_number,
      }).from(bankBranches).where(and(
        routingNumber ? eq(bankBranches.routing_number, routingNumber) : undefined,
        bank ? sql`strpos(lower(${bankBranches.bank_name}), ${bank}) > 0` : undefined,
        branch ? sql`strpos(lower(${bankBranches.branch_name}), ${branch}) > 0` : undefined,
        district ? sql`strpos(lower(${bankBranches.district_name}), ${district}) > 0` : undefined,
      )).orderBy(
        sql`(lower(${bankBranches.bank_name}) = ${bank ?? ""} AND lower(${bankBranches.branch_name}) = ${branch ?? ""}) DESC`,
        asc(bankBranches.bank_name), asc(bankBranches.branch_name), asc(bankBranches.routing_number),
      ).limit(21);
      const exact = rows.filter((row) => row.bankName.toLowerCase() === bank && row.branchName.toLowerCase() === branch);
      const matches = exact.length ? exact : rows;
      if (matches.length === 1) return { status: "matched", ...matches[0] };
      return {
        status: matches.length ? "ambiguous" : "not_found",
        candidates: matches.slice(0, 20),
        hasMore: matches.length > 20,
      };
    },
  }),
  defineTool({
    name: "finance_banks_lookup_swift",
    scope: "banking",
    description:
      "Look up international SWIFT/BIC code details (bank name, city, branch, country).",
    write: false,
    schema: z.object({
      swiftCode: z
        .string()
        .min(8)
        .max(11)
        .describe("8 or 11 character SWIFT/BIC code (e.g. 'SCBLBDDX')"),
    }),
    handler: async ({ swiftCode }) => {
      const result = await lookupSwiftCode(swiftCode.trim().toUpperCase());
      if (!result) throw new Error(`SWIFT code '${swiftCode}' not found`);
      return result;
    },
  }),

  // =========================================================================
  // ACCOUNTS (DEBIT & PAYMENT RECEIVING)
  // =========================================================================
  defineTool({
    name: "finance_accounts_list_debit",
    scope: "accounts",
    description:
      "List Standard Chartered Bank funding debit accounts with active default indicator.",
    write: false,
    schema: z.object({}),
    handler: async () => {
      const accounts = await db.select().from(debitAccounts);
      return { accounts };
    },
  }),
  defineTool({
    name: "finance_accounts_set_default_debit",
    scope: "accounts",
    description:
      "Set the active default SCB debit account for bulk payroll transactions.",
    write: true,
    schema: z.object({
      id: z.string().uuid().describe("Debit account UUID to set as default"),
    }),
    handler: async ({ id }) => {
      const defaultAccount = await assignDefaultDebitAccount(id);
      return { success: true, defaultAccount };
    },
  }),
  defineTool({
    name: "finance_accounts_list_payment",
    scope: "accounts",
    description:
      "List Themefisher receiving bank accounts displayed on Form-C and invoices.",
    write: false,
    schema: z.object({}),
    handler: async () => {
      const accounts = await db.select().from(paymentAccounts);
      return { accounts };
    },
  }),
  defineTool({
    name: "finance_accounts_create_payment",
    scope: "accounts",
    description:
      "Register a new Themefisher receiving bank account for international remittance.",
    write: true,
    schema: z.object({
      bankName: z.string().min(1).describe("Bank name"),
      bankAddress: z.string().optional().describe("Bank branch address"),
      nameOnAccount: z.string().trim().min(1).max(150).describe("Official account holder name"),
      bicSwift: z.string().optional().describe("SWIFT / BIC code"),
      accountNumber: z.string().trim().min(5).max(100).describe("Bank account / IBAN number"),
      accountName: z.string().trim().max(150).optional(),
      accountDetails: z.string().trim().max(4000).optional(),
    }),
    handler: async (input) => {
      const [created] = await db
        .insert(paymentAccounts)
        .values({
          bank_name: input.bankName.trim(),
          bank_address: input.bankAddress,
          name_on_account: input.nameOnAccount.trim(),
          bic_swift: input.bicSwift?.trim().toUpperCase(),
          account_number: input.accountNumber,
          account_name: input.accountName,
          account_details: input.accountDetails,
        })
        .returning();
      return { success: true, paymentAccount: created };
    },
  }),

  // =========================================================================
  // APP ACTIVITY & AUDIT LOGS
  // =========================================================================
  defineTool({
    name: "finance_logs_list",
    scope: "logs",
    description:
      "Query application activity logs including generated SCB bulk transfer Excels, salary sheets, invoice changes, and bank operations.",
    write: false,
    schema: z.object({
      cursor: pageCursor.describe("Use nextCursor from the previous page with the same filters"),
      domain: z
        .enum(["all", "scb_tools", "invoice_tools", "settings", "auth"])
        .optional()
        .describe("Filter by domain"),
      action: z
        .string()
        .optional()
        .describe(
          "Filter by action (e.g. 'excel_export_salary', 'excel_export_transfers', 'invoice_create')",
        ),
      search: z
        .string()
        .optional()
        .describe("Search term matching title, filename, or debit account"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(20)
        .optional()
        .describe("Max number of records to return (default 20, max 100)"),
    }),
    handler: async ({ domain, action, search, cursor, limit = 20 }) => {
      const conditions = [];
      if (domain && domain !== "all") {
        conditions.push(eq(activityLogs.domain, domain));
      }
      if (action && action !== "all") {
        conditions.push(eq(activityLogs.action, action));
      }
      if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        conditions.push(
          or(
            ilike(activityLogs.title, term),
            ilike(activityLogs.entityId, term),
            sql`(${activityLogs.details}->>'fileName') ILIKE ${term}`,
            sql`(${activityLogs.details}->>'reason') ILIKE ${term}`,
            sql`(${activityLogs.details}->>'debitAccount') ILIKE ${term}`,
          ),
        );
      }
      const whereClause = and(...conditions, beforePage(cursor, activityLogs.createdAt, activityLogs.id));
      const rows = await db
        .select({
          id: activityLogs.id,
          domain: activityLogs.domain,
          action: activityLogs.action,
          entityType: activityLogs.entityType,
          entityId: activityLogs.entityId,
          title: activityLogs.title,
          status: activityLogs.status,
          fileName: sql<string>`${activityLogs.details}->>'fileName'`,
          totalAmount: sql<number>`(${activityLogs.details}->>'totalAmount')::numeric`,
          currency: sql<string>`${activityLogs.details}->>'currency'`,
          itemCount: sql<number>`(${activityLogs.details}->>'itemCount')::int`,
          debitAccount: sql<string>`${activityLogs.details}->>'debitAccount'`,
          reason: sql<string>`${activityLogs.details}->>'reason'`,
          createdAt: activityLogs.createdAt,
          cursorTimestamp: pageTimestamp(activityLogs.createdAt),
        })
        .from(activityLogs)
        .where(whereClause)
        .orderBy(desc(activityLogs.createdAt), desc(activityLogs.id))
        .limit(limit + 1);
      const page = finishPage(rows, limit);

      return { total: page.items.length, logs: page.items, nextCursor: page.nextCursor };
    },
  }),
  defineTool({
    name: "finance_logs_get_excel_export",
    scope: "logs",
    description:
      "Retrieve full itemized payee breakdown and metadata for a specific generated SCB bulk transfer or salary sheet Excel export.",
    write: false,
    schema: z.object({
      logId: z.string().uuid().optional().describe("Activity log UUID"),
      fileName: z.string().optional().describe("Generated Excel filename"),
      latest: z
        .boolean()
        .optional()
        .describe("Set true to fetch the most recent export"),
    }),
    handler: async ({ logId, fileName, latest }) => {
      let condition;
      if (logId) {
        condition = eq(activityLogs.id, logId);
      } else if (fileName) {
        condition = sql`(${activityLogs.details}->>'fileName') = ${fileName}`;
      } else if (latest) {
        condition = or(
          eq(activityLogs.action, "excel_export_transfers"),
          eq(activityLogs.action, "excel_export_salary"),
        );
      } else {
        throw new Error("Provide logId, fileName, or set latest: true");
      }

      const [row] = await db
        .select()
        .from(activityLogs)
        .where(and(condition, or(eq(activityLogs.action, "excel_export_transfers"), eq(activityLogs.action, "excel_export_salary"))))
        .orderBy(desc(activityLogs.createdAt))
        .limit(1);

      if (!row) {
        return { error: "No matching Excel export log found" };
      }

      const details = row.details as any;
      return {
        id: row.id,
        title: row.title,
        action: row.action,
        createdAt: row.createdAt,
        metadata: {
          fileName: details?.fileName,
          sheetName: details?.sheetName,
          totalAmount: details?.totalAmount,
          currency: details?.currency || "BDT",
          itemCount: details?.itemCount,
          debitAccount: details?.debitAccount,
          paymentDate: details?.paymentDate,
          reason: details?.reason,
        },
        items: details?.items || [],
      };
    },
  }),
  defineTool({
    name: "finance_payment_requests_list",
    scope: "payment_requests",
    description:
      "List incoming public payment requests with filters by status (pending, verified, approved, exported, rejected, or all) and search terms.",
    write: false,
    schema: z.object({
      cursor: pageCursor.describe("Use nextCursor from the previous page with the same filters"),
      status: z
        .enum(["pending", "verified", "approved", "exported", "rejected", "all"])
        .optional()
        .describe("Filter by payment request status"),
      search: z
        .string()
        .optional()
        .describe("Search term for payee, bank, account number, or tracking code"),
      limit: z.number().int().min(1).max(100).default(50).optional(),
    }),
    handler: async ({ status, search, cursor, limit = 50 }) => {
      const conditions = [];
      if (status && status !== "all") {
        conditions.push(eq(paymentRequests.status, status));
      }
      if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        conditions.push(
          or(
            ilike(paymentRequests.payeeName, term),
            ilike(paymentRequests.trackingCode, term),
            ilike(paymentRequests.accountNumber, term),
            ilike(paymentRequests.bankName, term),
            ilike(paymentRequests.purpose, term),
          ),
        );
      }
      const whereClause = and(...conditions, beforePage(cursor, paymentRequests.createdAt, paymentRequests.id));
      const rows = await db
        .select({ ...getTableColumns(paymentRequests), cursorTimestamp: pageTimestamp(paymentRequests.createdAt) })
        .from(paymentRequests)
        .where(whereClause)
        .orderBy(desc(paymentRequests.createdAt), desc(paymentRequests.id))
        .limit(limit + 1);
      const page = finishPage(rows, limit);

      return {
        total: page.items.length,
        requests: page.items.map((row) => ({ ...row, review: paymentRequestReview(row) })),
        nextCursor: page.nextCursor,
      };
    },
  }),
  defineTool({
    name: "finance_payment_requests_get",
    scope: "payment_requests",
    description:
      "Get full details, bank details, and verification checklist for a specific payment request by ID or tracking code.",
    write: false,
    schema: z.object({
      id: z.string().uuid().optional().describe("Payment request UUID"),
      trackingCode: z
        .string()
        .optional()
        .describe("Tracking reference code (e.g. PR-20261124-XXXX)"),
    }),
    handler: async ({ id, trackingCode }) => {
      let condition;
      if (id) {
        condition = eq(paymentRequests.id, id);
      } else if (trackingCode) {
        condition = eq(
          paymentRequests.trackingCode,
          trackingCode.trim().toUpperCase(),
        );
      } else {
        throw new Error("Provide either id or trackingCode");
      }

      const [row] = await db
        .select()
        .from(paymentRequests)
        .where(condition)
        .limit(1);

      if (!row) {
        return { error: "Payment request not found" };
      }
      return { request: row, review: paymentRequestReview(row) };
    },
  }),
  defineTool({
    name: "finance_payment_requests_verify",
    scope: "payment_requests",
    description: "Check bank routing, duplicates, and existing beneficiary for a request awaiting review. Optionally attach review notes.",
    write: true,
    schema: z.object({ id: z.uuid(), notes: z.string().trim().max(1000).optional() }),
    handler: async ({ id, notes }) => {
      const { updated, verification, status } = await verifyPaymentRequest(id, notes);
      return {
        success: true,
        message: status === "verified"
          ? "Routing and duplicate checks passed. The request is ready for human review."
          : "Verification checks completed. Review the flagged items before approval.",
        request: updated,
        review: paymentRequestReview(updated),
        verification,
      };
    },
  }),
  ...workflowTools,
];
