import { db } from "@/db";
import {
  createDebitAccount,
  deleteDebitAccount,
  getScbDebitAccountNumber,
  updateDebitAccount,
} from "@/db/debit-accounts";
import { activityLogs, mcpRuns, paymentAccounts, paymentRequests, vendors } from "@/db/schema";
import {
  approvePaymentRequest,
  PaymentRequestReviewError,
  paymentRequestReviewSchema,
  exportApprovedPaymentRequests,
  paymentRequestFields,
  rejectPaymentRequest,
  submitPaymentRequest,
} from "@/lib/payment-request-operations";
import { buildScbWorkbook, formatTransferDate, isPaymentAmount, scbWorkbookRow } from "@/lib/scb-workbook";
import type { ActivityLogDetails } from "@/types";
import { format } from "date-fns";
import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import { beforePage, finishPage, pageCursor, pageTimestamp } from "./pagination";
import { parseRemittancePdf, remittancePdfFields } from "./remittance-pdf";
import { defineTool, McpToolError } from "./tool-definition";

const accountFields = z.object({
  accountNumber: z.string().trim().min(1).max(100),
  accountLabel: z.string().trim().min(1).max(150).optional(),
  bankName: z.string().trim().min(1).max(150).optional(),
});
const id = z.uuid().describe("Record UUID");
const operatorConfirmed = z.literal(true).describe("Set true only after the operator confirms this exact action.");
const paymentDate = z.string().refine((date) => Boolean(formatTransferDate(date)), "Use a valid YYYY-MM-DD payment date");

async function encodeWorkbook(rows: Record<string, string>[], sheetName: string, fileName: string) {
  const { xlsx, workbook } = await buildScbWorkbook(rows, sheetName);
  return {
    fileName,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xlsxBase64: xlsx.write(workbook, { type: "base64", bookType: "xlsx", compression: true }) as string,
  };
}

export const workflowTools = [
  defineTool({
    name: "finance_invoices_parse_remittance",
    scope: "invoices",
    description: "Extract invoice fields from a Base64-encoded MT103 PDF of up to 180 KiB and 10 pages. Provide a per-file password if needed. Returns a draft for review before creating an invoice.",
    write: false,
    schema: remittancePdfFields,
    handler: parseRemittancePdf,
  }),
  defineTool({
    name: "finance_accounts_create_debit",
    scope: "accounts",
    description: "Create an SCB funding account. The first account becomes the default automatically.",
    write: true,
    schema: accountFields,
    handler: async ({ accountNumber, accountLabel, bankName }) => ({
      debitAccount: await createDebitAccount({ account_number: accountNumber, account_label: accountLabel, bank_name: bankName }),
    }),
  }),
  defineTool({
    name: "finance_accounts_update_debit",
    scope: "accounts",
    description: "Edit an SCB funding account. Use the set-default tool to change the default.",
    write: true,
    schema: accountFields.partial().extend({ id })
      .refine(({ accountNumber, accountLabel, bankName }) => Boolean(accountNumber || accountLabel || bankName), "Provide at least one field to update"),
    handler: async ({ id, accountNumber, accountLabel, bankName }) => {
      const debitAccount = await updateDebitAccount(id, {
        account_number: accountNumber, account_label: accountLabel, bank_name: bankName,
      });
      if (!debitAccount) throw new McpToolError("Debit account not found.");
      return { debitAccount };
    },
  }),
  defineTool({
    name: "finance_accounts_delete_debit",
    scope: "accounts",
    description: "Remove an SCB funding account. Set another account as default before removing the current default when other accounts exist.",
    write: true,
    schema: z.object({ id, operatorConfirmed }),
    handler: async ({ id }) => {
      await deleteDebitAccount(id);
      return { deletedId: id };
    },
  }),
  defineTool({
    name: "finance_accounts_delete_payment",
    scope: "accounts",
    description: "Remove a configured inward-remittance receiving account by UUID.",
    write: true,
    schema: z.object({ id, operatorConfirmed }),
    handler: async ({ id }) => {
      const [deleted] = await db.delete(paymentAccounts).where(eq(paymentAccounts.id, id)).returning({ id: paymentAccounts.id });
      if (!deleted) throw new McpToolError("Receiving account not found.");
      return { deletedId: deleted.id };
    },
  }),
  defineTool({
    name: "finance_payouts_submit",
    scope: "payment_operations",
    description: "Submit a beneficiary payment request and return its UUID, tracking code, status, initial verification, and operator review fields.",
    write: true,
    requireIdempotency: true,
    schema: paymentRequestFields.omit({ website_hp: true }).refine(
      (data) => data.accountNumber === data.confirmAccountNumber,
      { message: "Account numbers must match.", path: ["confirmAccountNumber"] },
    ),
    handler: async (input) => {
      const result = await submitPaymentRequest(input);
      if (!result.success) throw new McpToolError(result.error ?? "Payment request was rejected.");
      return result;
    },
  }),
  defineTool({
    name: "finance_payouts_approve",
    scope: "payment_operations",
    description: "Approve a payment request after operator review. Pass the exact review object from submit, list, get, or verify. Saving the beneficiary requires the vendors scope.",
    write: true,
    requireIdempotency: true,
    schema: z.object({
      id,
      saveAsVendor: z.boolean().optional(),
      operatorConfirmed,
      review: paymentRequestReviewSchema,
    }).refine(({ id, review }) => id === review.requestId, "The reviewed request ID must match the selected request"),
    handler: async ({ id, saveAsVendor, review }, scopes = []) => {
      if (saveAsVendor && !scopes.includes("vendors") && !scopes.includes("*")) {
        throw new McpToolError("The vendors scope is required to save the beneficiary.", undefined, true);
      }
      try {
        const request = await approvePaymentRequest(id, { saveAsVendor, review });
        return { id: request.id, status: request.status, approvedAt: request.approvedAt };
      } catch (err) {
        if (err instanceof PaymentRequestReviewError) throw new McpToolError(err.message, undefined, true);
        throw err;
      }
    },
  }),
  defineTool({
    name: "finance_payouts_reject",
    scope: "payment_operations",
    description: "Reject a payment request awaiting review and record the operator's reason.",
    write: true,
    requireIdempotency: true,
    schema: z.object({ id, reason: z.string().trim().min(1).max(1000), operatorConfirmed }),
    handler: async ({ id, reason }) => {
      const request = await rejectPaymentRequest(id, reason);
      return { id: request.id, status: request.status };
    },
  }),
  defineTool({
    name: "finance_payouts_export",
    scope: "payment_operations",
    description: "Export up to 100 approved requests to an SCB XLSX after operator confirmation. Returns a Base64 workbook and marks the included requests exported. Recover the workbook by request ID after a lost response. Requires accounts scope.",
    write: true,
    requireIdempotency: true,
    schema: z.object({
      requestIds: z.array(id).min(1).max(100),
      debitAccountId: z.uuid().optional().describe("Defaults to the configured SCB debit account"),
      operatorConfirmed,
    }),
    handler: async ({ requestIds, debitAccountId }) => {
      const { rows, fileName, exportedIds, count, totalAmount } = await exportApprovedPaymentRequests(requestIds, debitAccountId);
      return {
        ...await encodeWorkbook(rows, "Payment Requests", fileName),
        exportedIds,
        skippedIds: [...new Set(requestIds)].filter((requestId) => !exportedIds.includes(requestId)),
        count,
        totalAmount,
      };
    },
  }),
  defineTool({
    name: "finance_payouts_get_workbook",
    scope: "payment_operations",
    description: "Recover the saved SCB workbook for a previously exported payment request UUID. Use this after losing an export response. Requires accounts scope.",
    write: false,
    schema: z.object({ id }),
    handler: async ({ id }) => {
      const [request] = await db.select({ fileName: paymentRequests.scbFileName }).from(paymentRequests)
        .where(and(eq(paymentRequests.id, id), eq(paymentRequests.status, "exported"))).limit(1);
      if (!request?.fileName) throw new McpToolError("No export has been recorded for this payment request.");
      const [log] = await db.select({ details: activityLogs.details }).from(activityLogs)
        .where(and(
          eq(activityLogs.action, "excel_export_transfers"),
          eq(activityLogs.entityId, request.fileName),
          or(
            eq(activityLogs.entityType, "payment_request_export"),
            and(eq(activityLogs.entityType, "excel_export"), like(activityLogs.title, "Exported SCB payment requests: %")),
          ),
          sql`${activityLogs.details}->>'sheetName' = 'Payment Requests'`,
        )).orderBy(desc(activityLogs.createdAt), desc(activityLogs.id)).limit(1);
      const details = log?.details as ActivityLogDetails | undefined;
      const debit = details?.debitAccount;
      const date = details?.paymentDate;
      if (!details?.items?.length || !debit || !date) {
        throw new McpToolError("The original workbook data is incomplete. Open the payment request's entry in Activity Logs.");
      }

      const rows = details.items.map((item) => scbWorkbookRow(item, date, debit));
      return { ...await encodeWorkbook(rows, "Payment Requests", request.fileName), count: rows.length };
    },
  }),
  defineTool({
    name: "finance_scb_prepare_workbook",
    scope: "vendors",
    description: "Create a draft SCB transfer or payroll XLSX. For whole payroll, set allActiveEmployees and add optional item overrides, exclusions, and additional payouts. Requires vendors and accounts scopes, plus payroll for payroll workbooks.",
    write: false,
    schema: z.object({
      type: z.enum(["transfers", "payroll"]).default("transfers"),
      debitAccountId: z.uuid().optional(),
      paymentDate,
      allActiveEmployees: z.boolean().default(false),
      excludeVendorIds: z.array(z.uuid()).max(100).default([]),
      items: z.array(z.object({
        vendorId: z.uuid(),
        amount: z.string().max(15).refine(isPaymentAmount, "Use a positive amount with up to two decimal places").optional(),
        reason: z.string().trim().max(140).optional(),
      })).max(100).default([]),
      additionalItems: z.array(z.object({
        vendorId: z.uuid(),
        amount: z.string().max(15).refine(isPaymentAmount, "Use a positive amount with up to two decimal places"),
        reason: z.string().trim().max(140).optional(),
      })).max(100).default([]),
    }).refine((input) => {
      if (input.allActiveEmployees) return input.type === "payroll";
      return input.items.length > 0 && input.excludeVendorIds.length === 0 && input.additionalItems.length === 0;
    }, "Provide items, or set allActiveEmployees for payroll. Exclusions and additionalItems apply only to whole payroll."),
    handler: async ({
      type, debitAccountId, paymentDate, items, allActiveEmployees = false, excludeVendorIds = [], additionalItems = [],
    }, scopes = []) => {
      if (type === "payroll" && !scopes.includes("payroll") && !scopes.includes("*")) {
        throw new McpToolError("The payroll scope is required to prepare a payroll workbook.");
      }

      const ids = [...new Set([...items, ...additionalItems].map((item) => item.vendorId))];
      const filter = allActiveEmployees
        ? or(eq(vendors.is_employee, true), ids.length ? inArray(vendors.id, ids) : undefined)
        : inArray(vendors.id, ids);
      const [debit, records] = await Promise.all([
        getScbDebitAccountNumber(debitAccountId),
        db.select({
          id: vendors.id,
          name: vendors.receiver_name,
          accountNumber: vendors.account_number,
          routingNumber: vendors.routing_number,
          isEmployee: vendors.is_employee,
          salary: type === "payroll" ? vendors.salary : sql<null>`null`,
        }).from(vendors).where(and(filter, sql`${vendors.is_hidden} IS NOT TRUE`)),
      ]);
      const byId = new Map(records.map((vendor) => [vendor.id, vendor]));
      let payees = items;
      if (allActiveEmployees) {
        const excluded = new Set(excludeVendorIds);
        const overrides = new Map(items.map((item) => [item.vendorId, item]));
        if (overrides.size !== items.length || items.some(({ vendorId }) => !byId.get(vendorId)?.isEmployee || excluded.has(vendorId))) {
          throw new McpToolError("Pass one override per included active employee. Use additionalItems for separate payouts.");
        }
        const employees = records.filter((vendor) => vendor.isEmployee && !excluded.has(vendor.id))
          .sort((first, second) => first.name.localeCompare(second.name) || first.id.localeCompare(second.id));
        payees = [...employees.map(({ id }) => overrides.get(id) ?? { vendorId: id }), ...additionalItems];
      }
      if (payees.length < 1 || payees.length > 100) {
        throw new McpToolError("A workbook must contain between 1 and 100 payouts. Select employees or use exclusions to split larger payrolls.");
      }

      const date = formatTransferDate(paymentDate)!;
      const problems: { row: number; vendorId: string; message: string }[] = [];
      const rows = payees.flatMap(({ vendorId, amount, reason }, index) => {
        const vendor = byId.get(vendorId);
        const value = amount ?? (type === "payroll" && vendor?.isEmployee ? vendor.salary : null);
        const message = !vendor?.accountNumber.trim() || !/^\d{9}$/.test(vendor.routingNumber)
          ? "An active beneficiary with an account and a nine-digit routing number is required."
          : !value || !isPaymentAmount(value) ? "A positive payment amount with up to two decimal places is required." : null;
        if (message || !vendor || !value) {
          problems.push({ row: index + 1, vendorId, message: message ?? "Invalid payout." });
          return [];
        }
        return [scbWorkbookRow({
          beneficiaryName: vendor.name, accountNumber: vendor.accountNumber, routingNumber: vendor.routingNumber,
          amount: value, reason: reason ?? (type === "payroll" ? "Salary payment" : ""),
        }, date, debit)];
      });
      if (problems.length) throw new McpToolError("Correct the listed payout rows before preparing a workbook.", { rows: problems });

      const sheetName = type === "payroll" ? "Salary Sheet" : "Transfers";
      return {
        ...await encodeWorkbook(rows, sheetName, `SCB_${type === "payroll" ? "Salary_Sheet" : "Transfers"}_${format(new Date(), "yyyyMMdd_HHmmss")}.xlsx`),
        count: rows.length,
      };
    },
  }),
  defineTool({
    name: "finance_logs_list_mcp_runs",
    scope: "logs",
    description: "List MCP tool execution metadata and status for troubleshooting.",
    write: false,
    schema: z.object({
      limit: z.number().int().min(1).max(100).default(30),
      cursor: pageCursor.describe("Use nextCursor from the previous page"),
    }),
    handler: async ({ limit, cursor }) => {
      const rows = await db.select({
        id: mcpRuns.id,
        toolName: mcpRuns.toolName,
        status: mcpRuns.status,
        durationMs: mcpRuns.durationMs,
        createdAt: mcpRuns.createdAt,
        cursorTimestamp: pageTimestamp(mcpRuns.createdAt),
      }).from(mcpRuns).where(beforePage(cursor, mcpRuns.createdAt, mcpRuns.id))
        .orderBy(desc(mcpRuns.createdAt), desc(mcpRuns.id)).limit(limit + 1);
      const page = finishPage(rows, limit);
      return { runs: page.items, nextCursor: page.nextCursor };
    },
  }),
];
