import { db } from "@/db";
import { invoices } from "@/db/schema";
import { logActivity } from "@/lib/activity-log";
import { invoiceFields } from "@/lib/invoice-validation";
import type { Invoice } from "@/types";
import { sql } from "drizzle-orm";

export async function insertInvoice(data: Partial<Invoice>) {
  const { amount, received_amount } = invoiceFields.parse(data);
  const values = {
    ...data,
    amount: typeof amount === "number" ? String(amount) : amount,
    received_amount: typeof received_amount === "number" ? String(received_amount) : received_amount,
  };
  if (data.invoice_number?.trim()) {
    const [result] = await db
      .insert(invoices)
      .values({ ...values, invoice_number: data.invoice_number.trim() })
      .returning();
    if (result) {
      await logActivity({
        domain: "invoice_tools",
        action: "invoice_create",
        entityType: "invoice",
        entityId: result.invoice_number,
        title: `Created invoice ${result.invoice_number} ($${Number(result.amount || 0).toLocaleString()} ${result.currency || "USD"})`,
        details: {
          extra: {
            invoiceNumber: result.invoice_number,
            amount: result.amount,
            currency: result.currency,
            invoiceDate: result.invoice_date,
            clientId: result.client_id,
          },
        },
      }).catch(() => {});
    }
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
      .values({ ...values, invoice_number })
      .onConflictDoNothing({ target: invoices.invoice_number })
      .returning();
    if (result) {
      await logActivity({
        domain: "invoice_tools",
        action: "invoice_create",
        entityType: "invoice",
        entityId: result.invoice_number,
        title: `Created invoice ${result.invoice_number} ($${Number(result.amount || 0).toLocaleString()} ${result.currency || "USD"})`,
        details: {
          extra: {
            invoiceNumber: result.invoice_number,
            amount: result.amount,
            currency: result.currency,
            invoiceDate: result.invoice_date,
            clientId: result.client_id,
          },
        },
      }).catch(() => {});
      return result;
    }
  }
  throw new Error("Could not assign an invoice number. Try again.");
}
