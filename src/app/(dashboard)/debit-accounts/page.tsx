import { getDebitAccounts } from "@/actions";
import DebitAccountsClient from "./debit-accounts-client";

export const dynamic = "force-dynamic";

export default async function Page() {
  const accounts = await getDebitAccounts();
  return <DebitAccountsClient initialAccounts={accounts} />;
}
