"use server";

import { db } from "@/db";
import { clients, invoices } from "@/db/schema";
import { logActivity } from "@/lib/activity-log";
import { requireBrowserSession } from "@/lib/browser-session";
import { insertInvoice } from "@/lib/create-invoice";
import { invoiceFields } from "@/lib/invoice-validation";
import type { Invoice } from "@/types";
import { and, count, desc, eq, getTableColumns, or, sql } from "drizzle-orm";

export async function getInvoices(): Promise<Invoice[]> {
  await requireBrowserSession();
  const data = await db
    .select()
    .from(invoices)
    .orderBy(desc(invoices.createdAt));
  return data as unknown as Invoice[];
}

export async function getInvoiceHistory(page = 1, search = "", clientId = "") {
  await requireBrowserSession();
  const pageSize = 10;
  const term = search.trim().slice(0, 200).toLowerCase();
  const contains = (column: ReturnType<typeof sql>) =>
    sql`strpos(lower(coalesce(${column}, '')), ${term}) > 0`;
  const filters = and(
    clientId && /^[0-9a-f-]{36}$/i.test(clientId)
      ? eq(invoices.client_id, clientId)
      : undefined,
    term
      ? or(
          contains(sql`${invoices.invoice_number}`),
          contains(sql`${invoices.description}`),
          contains(sql`${clients.name}`),
          contains(sql`${invoices.invoice_date}::text`),
        )
      : undefined,
  );
  const [{ total }] = await db
    .select({ total: count() })
    .from(invoices)
    .leftJoin(clients, eq(invoices.client_id, clients.id))
    .where(filters);
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(
    lastPage,
    Number.isSafeInteger(page) ? Math.max(1, page) : 1,
  );
  const rows = await db
    .select(getTableColumns(invoices))
    .from(invoices)
    .leftJoin(clients, eq(invoices.client_id, clients.id))
    .where(filters)
    .orderBy(
      sql`${invoices.invoice_date} DESC NULLS LAST`,
      desc(invoices.createdAt),
      desc(invoices.id),
    )
    .limit(pageSize)
    .offset((current - 1) * pageSize);
  return { rows: rows as unknown as Invoice[], total, page: current, pageSize };
}

export async function createInvoice(data: Partial<Invoice>) {
  await requireBrowserSession();
  return insertInvoice(data);
}

export async function updateInvoice(id: string, data: Partial<Invoice>) {
  await requireBrowserSession();
  invoiceFields.parse(data);
  const [result] = await db
    .update(invoices)
    .set({ ...data, createdAt: undefined } as any)
    .where(eq(invoices.id, id))
    .returning();

  if (result) {
    await logActivity({
      domain: "invoice_tools",
      action: "invoice_update",
      entityType: "invoice",
      entityId: result.invoice_number || id,
      title: `Updated invoice ${result.invoice_number || id}`,
      details: {
        extra: {
          id,
          invoiceNumber: result.invoice_number,
          amount: result.amount,
          receivedAmount: result.received_amount,
        },
      },
    }).catch(() => {});
  }

  return result;
}

export async function deleteInvoice(id: string) {
  await requireBrowserSession();
  await db.delete(invoices).where(eq(invoices.id, id));

  await logActivity({
    domain: "invoice_tools",
    action: "invoice_delete",
    entityType: "invoice",
    entityId: id,
    title: `Deleted invoice`,
    details: {
      extra: { id },
    },
  }).catch(() => {});
}

export async function getPdfPassword(): Promise<string | undefined> {
  await requireBrowserSession();
  return process.env.PDF_PASSWORD;
}
