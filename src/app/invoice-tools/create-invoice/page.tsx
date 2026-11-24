import { getClients, getInvoiceHistory, getPaymentAccounts } from "@/actions";
import CreateInvoiceClient from "./CreateInvoiceClient";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [clients, accounts, invoices] = await Promise.all([
    getClients(),
    getPaymentAccounts(),
    getInvoiceHistory(),
  ]);

  return (
    <CreateInvoiceClient
      initialClients={clients}
      initialAccounts={accounts}
      initialHistory={invoices}
    />
  );
}
