"use server";

import { db } from "@/db";
import {
  assignDefaultDebitAccount,
  lockDebitAccounts,
} from "@/db/debit-accounts";
import { debitAccounts } from "@/db/schema";
import { requireBrowserSession } from "@/lib/browser-session";
import type { DebitAccount } from "@/types";
import { eq, sql } from "drizzle-orm";
import { logActivity } from "./activity-logs";

export async function getDebitAccounts(): Promise<DebitAccount[]> {
  await requireBrowserSession();
  const data = await db.select().from(debitAccounts);
  return data as unknown as DebitAccount[];
}

export async function createDebitAccount(data: Partial<DebitAccount>) {
  await requireBrowserSession();
  const accountNumber = data.account_number?.trim();
  if (!accountNumber) throw new Error("A debit account number is required.");
  const [, [result]] = await db.batch([
    lockDebitAccounts(),
    db
      .insert(debitAccounts)
      .values({
        account_number: accountNumber,
        account_label: data.account_label,
        bank_name: data.bank_name,
        is_default: sql<boolean>`NOT EXISTS (SELECT 1 FROM ${debitAccounts} WHERE is_default IS TRUE)`,
      })
      .returning(),
  ]);

  if (result) {
    await logActivity({
      domain: "scb_tools",
      action: "debit_account_create",
      entityType: "debit_account",
      entityId: result.id,
      title: `Added SCB debit account: ${result.account_number} (${result.account_label || result.bank_name})`,
      details: {
        extra: {
          accountNumber: result.account_number,
          accountLabel: result.account_label,
          bankName: result.bank_name,
        },
      },
    }).catch(() => {});
  }

  return result;
}

export async function updateDebitAccount(
  id: string,
  data: Partial<DebitAccount>,
) {
  await requireBrowserSession();
  const [result] = await db
    .update(debitAccounts)
    .set({
      account_number: data.account_number,
      account_label: data.account_label,
      bank_name: data.bank_name,
    })
    .where(eq(debitAccounts.id, id))
    .returning();

  if (result) {
    await logActivity({
      domain: "scb_tools",
      action: "debit_account_update",
      entityType: "debit_account",
      entityId: result.id,
      title: `Updated SCB debit account: ${result.account_number}`,
      details: { extra: { id, ...data } },
    }).catch(() => {});
  }

  return result;
}

export async function deleteDebitAccount(id: string) {
  await requireBrowserSession();
  const [, [deleted]] = await db.batch([
    lockDebitAccounts(),
    db
      .delete(debitAccounts)
      .where(
        sql`
      ${debitAccounts.id} = ${id}
      AND (${debitAccounts.is_default} IS NOT TRUE
        OR NOT EXISTS (SELECT 1 FROM ${debitAccounts} AS other WHERE other.id <> ${id}))
    `,
      )
      .returning({ id: debitAccounts.id }),
  ]);
  if (!deleted)
    throw new Error(
      "Select another default account before deleting this account.",
    );

  await logActivity({
    domain: "scb_tools",
    action: "debit_account_delete",
    entityType: "debit_account",
    entityId: id,
    title: `Deleted SCB debit account`,
    details: { extra: { id } },
  }).catch(() => {});
}

export async function setDefaultDebitAccount(id: string) {
  await requireBrowserSession();
  await assignDefaultDebitAccount(id);

  await logActivity({
    domain: "scb_tools",
    action: "debit_account_update",
    entityType: "debit_account",
    entityId: id,
    title: `Set account as default SCB debit account`,
    details: { extra: { id, isDefault: true } },
  }).catch(() => {});
}
