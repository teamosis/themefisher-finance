"use server";

import { db } from "@/db";
import { eq } from "drizzle-orm";
import { debitAccounts } from "@/db/schema";
import type { DebitAccount } from "@/types";

export async function getDebitAccounts(): Promise<DebitAccount[]> {
  const data = await db.select().from(debitAccounts);
  return data as unknown as DebitAccount[];
}

export async function createDebitAccount(data: Partial<DebitAccount>) {
  const [result] = await db
    .insert(debitAccounts)
    .values(data as any)
    .returning();
  return result;
}

export async function updateDebitAccount(id: string, data: Partial<DebitAccount>) {
  const [result] = await db
    .update(debitAccounts)
    .set({ ...data, createdAt: undefined } as any)
    .where(eq(debitAccounts.id, id))
    .returning();
  return result;
}

export async function deleteDebitAccount(id: string) {
  await db.delete(debitAccounts).where(eq(debitAccounts.id, id));
}

export async function unsetAllDefaultDebitAccounts() {
  await db.update(debitAccounts).set({ is_default: false });
}

export async function setDefaultDebitAccount(id: string) {
  await unsetAllDefaultDebitAccounts();
  await db.update(debitAccounts).set({ is_default: true }).where(eq(debitAccounts.id, id));
}
