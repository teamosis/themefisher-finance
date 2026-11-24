import config from "@/config/config.json";
import type { Metadata } from "next";
import { Suspense } from "react";
import TrackPaymentClient from "./track-payment-client";

export const metadata: Metadata = {
  referrer: "no-referrer",
  title: `Track Payment Request | ${config.site.title}`,
  description:
    "Check the review and SCB Straight2Bank payout status of your submitted payment request.",
};

export default function TrackPaymentPage() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-4 sm:py-6">
      <Suspense
        fallback={
          <div className="max-w-xl w-full mx-auto p-8 text-center text-xs text-muted-foreground">
            Loading tracker...
          </div>
        }
      >
        <TrackPaymentClient />
      </Suspense>
    </main>
  );
}
