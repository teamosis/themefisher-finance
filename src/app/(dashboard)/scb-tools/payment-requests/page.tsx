import {
  getDebitAccounts,
  getPaymentRequests,
  getPaymentRequestsStats,
} from "@/actions";
import type { Metadata } from "next";
import PaymentRequestsClient from "./payment-requests-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Payment Requests | SCB Straight2Bank Tools",
  description:
    "Review incoming payment requests, verify bank account details, and export SCB Straight2Bank bulk Excel files.",
};

export default async function PaymentRequestsPage() {
  const [requests, debitAccounts, stats] = await Promise.all([
    getPaymentRequests(),
    getDebitAccounts(),
    getPaymentRequestsStats(),
  ]);

  return (
    <PaymentRequestsClient
      initialRequests={requests}
      initialDebitAccounts={debitAccounts}
      initialStats={stats}
    />
  );
}
