"use server";

import { db } from "@/db";
import { paymentAccounts } from "@/db/schema";
import { requireBrowserSession } from "@/lib/browser-session";
import type { PaymentAccount } from "@/types";
import { eq } from "drizzle-orm";

export async function getPaymentAccounts(): Promise<PaymentAccount[]> {
  await requireBrowserSession();
  const data = await db.select().from(paymentAccounts);
  return data as unknown as PaymentAccount[];
}

export async function createPaymentAccount(data: Partial<PaymentAccount>) {
  await requireBrowserSession();
  const [result] = await db
    .insert(paymentAccounts)
    .values(data as any)
    .returning();
  return result;
}

export async function deletePaymentAccount(id: string) {
  await requireBrowserSession();
  await db.delete(paymentAccounts).where(eq(paymentAccounts.id, id));
}
