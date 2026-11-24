"use server";

import { db } from "@/db";
import {
  createDebitAccount as createAccount,
  deleteDebitAccount as deleteAccount,
  setDefaultDebitAccount as setDefaultAccount,
  updateDebitAccount as updateAccount,
} from "@/db/debit-accounts";
import { debitAccounts } from "@/db/schema";
import { requireBrowserSession } from "@/lib/browser-session";
import type { DebitAccount } from "@/types";

export async function getDebitAccounts(): Promise<DebitAccount[]> {
  await requireBrowserSession();
  const data = await db.select().from(debitAccounts);
  return data as unknown as DebitAccount[];
}

export async function createDebitAccount(data: Partial<DebitAccount>) {
  await requireBrowserSession();
  return createAccount(data);
}

export async function updateDebitAccount(id: string, data: Partial<DebitAccount>) {
  await requireBrowserSession();
  return updateAccount(id, data);
}

export async function deleteDebitAccount(id: string) {
  await requireBrowserSession();
  return deleteAccount(id);
}

export async function setDefaultDebitAccount(id: string) {
  await requireBrowserSession();
  await setDefaultAccount(id);
}
