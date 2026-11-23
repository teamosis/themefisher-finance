"use server";

import { db } from "@/db";
import { eq } from "drizzle-orm";
import { paymentAccounts } from "@/db/schema";
import type { PaymentAccount } from "@/types";

export async function getPaymentAccounts(): Promise<PaymentAccount[]> {
  const data = await db.select().from(paymentAccounts);
  return data as unknown as PaymentAccount[];
}

export async function createPaymentAccount(data: Partial<PaymentAccount>) {
  const [result] = await db
    .insert(paymentAccounts)
    .values(data as any)
    .returning();
  return result;
}

export async function deletePaymentAccount(id: string) {
  await db.delete(paymentAccounts).where(eq(paymentAccounts.id, id));
}
