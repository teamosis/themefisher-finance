"use server";

import { db } from "@/db";
import { clients, invoices } from "@/db/schema";
import { requireBrowserSession } from "@/lib/browser-session";
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
  invoiceFields.parse(data);
  if (data.invoice_number?.trim()) {
    const [result] = await db
      .insert(invoices)
      .values(data as any)
      .returning();
    return result;
  }

  const date = data.invoice_date ?? "";
  const parsedDate = new Date(date);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== date
  ) {
    throw new Error("A valid invoice date is required to assign a number.");
  }

  const prefix = `TF-${date}-`;
  for (let attempt = 0; attempt < 8; attempt++) {
    const [row] = await db
      .select({
        last: sql<number>`coalesce(max(right(${invoices.invoice_number}, 2)::int), 0)`,
      })
      .from(invoices)
      .where(sql`${invoices.invoice_number} ~ ${`^${prefix}[0-9]{2}$`}`);
    const next = Number(row?.last ?? 0) + 1;
    if (next > 99)
      throw new Error("The daily invoice number limit has been reached.");
    const invoice_number = `${prefix}${String(next).padStart(2, "0")}`;
    const [result] = await db
      .insert(invoices)
      .values({ ...data, invoice_number } as any)
      .onConflictDoNothing({ target: invoices.invoice_number })
      .returning();
    if (result) return result;
  }
  throw new Error("Could not assign an invoice number. Try again.");
}

export async function updateInvoice(id: string, data: Partial<Invoice>) {
  await requireBrowserSession();
  invoiceFields.parse(data);
  const [result] = await db
    .update(invoices)
    .set({ ...data, createdAt: undefined } as any)
    .where(eq(invoices.id, id))
    .returning();
  return result;
}

export async function deleteInvoice(id: string) {
  await requireBrowserSession();
  await db.delete(invoices).where(eq(invoices.id, id));
}

export async function getPdfPassword(): Promise<string | undefined> {
  await requireBrowserSession();
  return process.env.PDF_PASSWORD;
}
