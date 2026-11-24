import { getPaymentRequestsStats } from "@/actions";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import config from "@/config/config.json";
import { db } from "@/db";
import {
  activityLogs,
  clients,
  invoices,
  paymentRequests,
  vendors,
} from "@/db/schema";
import { isAuthConfigured } from "@/lib/auth";
import { requireBrowserSession } from "@/lib/browser-session";
import { count, desc, eq, sql } from "drizzle-orm";
import { AlertTriangle, KeyRound } from "lucide-react";
import DashboardSummary from "./dashboard-summary";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `Dashboard | ${config.site.title}`,
  description:
    "Unified financial operations dashboard for inward remittance invoices and SCB bulk transaction processing.",
};

export default async function DashboardPage() {
  const configured = isAuthConfigured();

  if (!configured) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center items-center px-4 sm:px-6 py-12">
        <div className="max-w-xl w-full mx-auto">
          <Card className="border-destructive/30 bg-card shadow-lg overflow-hidden">
            <div className="h-2 bg-destructive w-full" />
            <CardHeader className="p-6 sm:p-8 pb-4 text-center">
              <div className="size-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-4">
                <KeyRound className="size-7" />
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-destructive/15 text-destructive text-xs font-medium mx-auto mb-2">
                <AlertTriangle className="size-3.5" />
                <span>Setup Required</span>
              </div>
              <CardTitle className="text-2xl font-bold text-text-strong tracking-tight">
                Environment Variables Missing
              </CardTitle>
              <CardDescription className="text-muted-foreground text-sm mt-2 leading-relaxed">
                To protect this application,{" "}
                <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted text-text-strong">
                  AUTH_PASSWORD
                </code>{" "}
                and{" "}
                <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted text-text-strong">
                  AUTH_SECRET
                </code>{" "}
                must be set on the environment. Without these variables
                configured, this site cannot be accessed.
              </CardDescription>
            </CardHeader>

            <CardFooter className="p-6 sm:p-8 pt-2 flex flex-col gap-4">
              <div className="w-full bg-muted/60 border border-border rounded-xl p-4 text-left font-mono text-xs text-text-default overflow-x-auto">
                <p className="text-muted-foreground mb-2">
                  # Add these to your .env.local file:
                </p>
                <p className="text-text-strong">
                  AUTH_PASSWORD=your_secure_password
                </p>
                <p className="text-text-strong">
                  AUTH_SECRET=a_random_32_character_secret
                </p>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                After setting the environment variables in{" "}
                <span className="text-text-default">.env.local</span>, restart
                the Next.js server to unlock access.
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  await requireBrowserSession();

  const [
    [invoiceTotals],
    [clientTotals],
    [vendorTotals],
    paymentStats,
    recentInvoices,
    recentPaymentRequests,
    recentLogs,
  ] = await Promise.all([
    db
      .select({
        count: count(),
        totalUsd: sql<string>`coalesce(sum(${invoices.amount}) filter (where coalesce(${invoices.currency}, 'USD') = 'USD'), 0)`,
      })
      .from(invoices),
    db.select({ count: count() }).from(clients),
    db
      .select({
        count: count(),
        employees: sql<number>`count(*) filter (where ${vendors.is_employee})::int`,
      })
      .from(vendors)
      .where(sql`${vendors.is_hidden} IS NOT TRUE`),
    getPaymentRequestsStats(),
    db
      .select({
        id: invoices.id,
        invoice_number: invoices.invoice_number,
        invoice_date: invoices.invoice_date,
        amount: invoices.amount,
        currency: invoices.currency,
        description: invoices.description,
        clientName: clients.name,
      })
      .from(invoices)
      .leftJoin(clients, eq(invoices.client_id, clients.id))
      .orderBy(desc(invoices.createdAt), desc(invoices.id))
      .limit(5),
    db
      .select({
        id: paymentRequests.id,
        payeeName: paymentRequests.payeeName,
        status: paymentRequests.status,
        bankName: paymentRequests.bankName,
        branchName: paymentRequests.branchName,
        purpose: paymentRequests.purpose,
        amount: paymentRequests.amount,
      })
      .from(paymentRequests)
      .orderBy(desc(paymentRequests.createdAt), desc(paymentRequests.id))
      .limit(5),
    db
      .select({
        id: activityLogs.id,
        title: activityLogs.title,
        domain: activityLogs.domain,
        status: activityLogs.status,
        createdAt: activityLogs.createdAt,
      })
      .from(activityLogs)
      .orderBy(desc(activityLogs.createdAt), desc(activityLogs.id))
      .limit(5),
  ]);

  return (
    <DashboardSummary
      invoiceCount={invoiceTotals.count}
      totalInvoicedUsd={Number(invoiceTotals.totalUsd)}
      clientCount={clientTotals.count}
      vendorCount={vendorTotals.count}
      employeesCount={vendorTotals.employees}
      paymentStats={paymentStats}
      recentInvoices={recentInvoices}
      recentPaymentRequests={recentPaymentRequests}
      recentLogs={recentLogs}
    />
  );
}
