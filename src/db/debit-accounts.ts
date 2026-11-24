import { logActivity } from "@/lib/activity-log";
import type { DebitAccount } from "@/types";
import { and, asc, eq, exists, ne, sql } from "drizzle-orm";
import { db } from "./index";
import { debitAccounts } from "./schema";

export function lockDebitAccounts() {
  return db.execute(
    sql`LOCK TABLE ${debitAccounts} IN SHARE ROW EXCLUSIVE MODE`,
  );
}

export async function assignDefaultDebitAccount(id: string) {
  const target = db
    .select({ id: debitAccounts.id })
    .from(debitAccounts)
    .where(eq(debitAccounts.id, id));
  const [, , [account]] = await db.batch([
    lockDebitAccounts(),
    db
      .update(debitAccounts)
      .set({ is_default: false })
      .where(
        and(
          eq(debitAccounts.is_default, true),
          ne(debitAccounts.id, id),
          exists(target),
        ),
      ),
    db
      .update(debitAccounts)
      .set({ is_default: true })
      .where(eq(debitAccounts.id, id))
      .returning(),
  ]);
  if (!account) throw new Error("Debit account not found");
  return account;
}

export async function getScbDebitAccountNumber(debitAccountId?: string) {
  const accountQuery = db
    .select({ accountNumber: debitAccounts.account_number })
    .from(debitAccounts);
  const [account] = await (debitAccountId
    ? accountQuery
        .where(eq(debitAccounts.id, debitAccountId))
        .limit(1)
    : accountQuery
        .orderBy(
          sql`(${debitAccounts.is_default} IS TRUE) DESC`,
          asc(debitAccounts.createdAt),
          asc(debitAccounts.id),
        )
        .limit(1));
  const debitAccountNum = account?.accountNumber.trim();

  if (!debitAccountNum) {
    throw new Error(
      "No SCB debit account found. Please configure a debit account in SCB Tools first.",
    );
  }

  return debitAccountNum;
}

export async function createDebitAccount(data: Partial<DebitAccount>) {
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
  const account = await assignDefaultDebitAccount(id);

  await logActivity({
    domain: "scb_tools",
    action: "debit_account_update",
    entityType: "debit_account",
    entityId: id,
    title: `Set account as default SCB debit account`,
    details: { extra: { id, isDefault: true } },
  }).catch(() => {});
  return account;
}
