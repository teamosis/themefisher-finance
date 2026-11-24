import { and, eq, exists, ne, sql } from "drizzle-orm";
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
