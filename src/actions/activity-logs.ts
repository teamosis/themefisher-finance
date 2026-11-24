"use server";

import { db } from "@/db";
import { activityLogs } from "@/db/schema";
import { logActivity } from "@/lib/activity-log";
import { requireBrowserSession } from "@/lib/browser-session";
import type { ActivityExcelItem, ActivityLog } from "@/types";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

export interface LogExcelExportInput {
  type: "transfers" | "salary";
  fileName: string;
  sheetName: string;
  totalAmount: number;
  currency?: string;
  itemCount: number;
  debitAccount: string;
  reason?: string;
  items: ActivityExcelItem[];
}

/**
 * Specialized logger for SCB Bulk Transfers and Salary Sheets Excel generation.
 */
export async function logExcelExport(
  input: LogExcelExportInput,
): Promise<ActivityLog> {
  await requireBrowserSession();
  const isSalary = input.type === "salary";
  const formattedTotal = Number(input.totalAmount || 0).toLocaleString("en-US");
  const currency = input.currency || "BDT";

  const title = isSalary
    ? `Exported SCB Salary Sheet: ${input.itemCount} payees (৳${formattedTotal} ${currency})`
    : `Exported SCB Bulk Transfers: ${input.itemCount} transfers (৳${formattedTotal} ${currency})`;

  return logActivity({
    domain: "scb_tools",
    action: isSalary ? "excel_export_salary" : "excel_export_transfers",
    entityType: isSalary ? "salary_sheet" : "excel_export",
    entityId: input.fileName,
    title,
    details: {
      fileName: input.fileName,
      sheetName: input.sheetName,
      totalAmount: input.totalAmount,
      currency,
      itemCount: input.itemCount,
      debitAccount: input.debitAccount,
      reason: input.reason,
      items: input.items,
    },
    status: "success",
  });
}

export interface GetActivityLogsFilters {
  domain?: string;
  action?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Fetch paginated activity logs with optional domain/action/search filters.
 */
export async function getActivityLogs(
  filters: GetActivityLogsFilters = {},
): Promise<{
  rows: ActivityLog[];
  total: number;
  page: number;
  limit: number;
}> {
  await requireBrowserSession();

  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(100, Math.max(1, filters.limit || 50));
  const offset = (page - 1) * limit;

  const conditions = [];

  if (filters.domain && filters.domain !== "all") {
    conditions.push(eq(activityLogs.domain, filters.domain));
  }

  if (filters.action && filters.action !== "all") {
    conditions.push(eq(activityLogs.action, filters.action));
  }

  if (filters.search && filters.search.trim()) {
    const term = `%${filters.search.trim()}%`;
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

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(activityLogs)
    .where(whereClause);

  const total = Number(countResult?.count || 0);

  const rows = await db
    .select()
    .from(activityLogs)
    .where(whereClause)
    .orderBy(desc(activityLogs.createdAt), desc(activityLogs.id))
    .limit(limit)
    .offset(offset);

  return {
    rows: rows as unknown as ActivityLog[],
    total,
    page,
    limit,
  };
}
