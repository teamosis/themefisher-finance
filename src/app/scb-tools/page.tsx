import { getDebitAccounts, getPayoutVendors } from "@/actions";
import ScbToolsClient from "./ScbToolsClient";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [vendors, debitAccounts] = await Promise.all([
    getPayoutVendors(),
    getDebitAccounts(),
  ]);

  return (
    <ScbToolsClient
      initialVendors={vendors}
      initialDebitAccounts={debitAccounts}
    />
  );
}
