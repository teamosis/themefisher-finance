import config from "@/config/config.json";
import type { Metadata } from "next";
import PaymentRequestFormClient from "./PaymentRequestFormClient";

export const metadata: Metadata = {
  title: `Submit Payment Request | ${config.site.title}`,
  description:
    "Submit your Bangladesh Bank beneficiary account details for Themefisher SCB Straight2Bank payment processing.",
};

export default function RequestPaymentPage() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-4 sm:py-6">
      <PaymentRequestFormClient />
    </main>
  );
}
