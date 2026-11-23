"use server";

import { db } from "@/db";
import { eq, desc } from "drizzle-orm";
import { invoices } from "@/db/schema";
import type { Invoice } from "@/types";

export async function getInvoices(): Promise<Invoice[]> {
  const data = await db
    .select()
    .from(invoices)
    .orderBy(desc(invoices.createdAt));
  return data as unknown as Invoice[];
}

export async function createInvoice(data: Partial<Invoice>) {
  const [result] = await db.insert(invoices).values(data as any).returning();
  return result;
}

export async function updateInvoice(id: string, data: Partial<Invoice>) {
  const [result] = await db
    .update(invoices)
    .set({ ...data, createdAt: undefined } as any)
    .where(eq(invoices.id, id))
    .returning();
  return result;
}

export async function deleteInvoice(id: string) {
  await db.delete(invoices).where(eq(invoices.id, id));
}
