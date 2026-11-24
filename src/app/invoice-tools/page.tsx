import { getClients, getInvoices, getPaymentAccounts } from "@/actions";
import { InvoiceToolsSkeleton } from "@/components";
import InvoiceToolsClient from "./InvoiceToolsClient";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [clients, invoices, paymentAccounts] = await Promise.all([
    getClients(),
    getInvoices(),
    getPaymentAccounts(),
  ]);

  return (
    <Suspense fallback={<InvoiceToolsSkeleton />}>
      <InvoiceToolsClient
        initialClients={clients}
        initialInvoices={invoices}
        initialPaymentAccounts={paymentAccounts}
      />
    </Suspense>
  );
}
