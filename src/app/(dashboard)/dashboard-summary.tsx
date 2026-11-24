import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { activityLogs, invoices, paymentRequests } from "@/db/schema";
import { format } from "date-fns";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  FileText,
  History,
  Inbox,
  PlusSquare,
  UserCheck,
  Users,
} from "lucide-react";
import Link from "next/link";

interface DashboardSummaryProps {
  invoiceCount: number;
  totalInvoicedUsd: number;
  clientCount: number;
  vendorCount: number;
  employeesCount: number;
  paymentStats: {
    actionableCount: number;
    approved: number;
    totalPendingAmount: number;
  };
  recentInvoices: (Pick<
    typeof invoices.$inferSelect,
    | "id"
    | "invoice_number"
    | "invoice_date"
    | "amount"
    | "currency"
    | "description"
  > & { clientName: string | null })[];
  recentPaymentRequests: Pick<
    typeof paymentRequests.$inferSelect,
    | "id"
    | "payeeName"
    | "status"
    | "bankName"
    | "branchName"
    | "purpose"
    | "amount"
  >[];
  recentLogs: Pick<
    typeof activityLogs.$inferSelect,
    "id" | "title" | "domain" | "status" | "createdAt"
  >[];
}

export default function DashboardSummary({
  invoiceCount,
  totalInvoicedUsd,
  clientCount,
  vendorCount,
  employeesCount,
  paymentStats,
  recentInvoices,
  recentPaymentRequests,
  recentLogs,
}: DashboardSummaryProps) {
  const externalVendorsCount = vendorCount - employeesCount;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 border border-amber-500/20">
            <Clock className="size-3" />
            Pending Review
          </span>
        );
      case "verified":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-500/10 text-sky-600 border border-sky-500/20">
            <Check className="size-3" />
            Routing Verified
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            <CheckCircle2 className="size-3" />
            Approved
          </span>
        );
      case "exported":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-500/10 text-purple-600 border border-purple-500/20">
            <FileSpreadsheet className="size-3" />
            Exported to SCB
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-destructive/10 text-destructive border border-destructive/20">
            <AlertCircle className="size-3" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6 pb-16">
      {/* Financial Metrics KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Inward Remittances */}
        <Link
          href="/invoice-tools"
          className="group block focus:outline-hidden"
        >
          <Card className="p-5 bg-card border-border hover:border-primary/40 transition-all duration-200 shadow-xs hover:shadow-md h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Inward Remittances
                </span>
                <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
                  <FileText className="size-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl sm:text-3xl font-bold text-text-strong block tracking-tight">
                  $
                  {totalInvoicedUsd.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  Across {invoiceCount} billing document
                  {invoiceCount === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs font-medium text-primary">
              <span>View Inward Docs</span>
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Card>
        </Link>

        {/* Metric 2: Pending Claims */}
        <Link
          href="/payment-requests"
          className="group block focus:outline-hidden"
        >
          <Card className="p-5 bg-card border-border hover:border-primary/40 transition-all duration-200 shadow-xs hover:shadow-md h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Pending Payout Claims
                </span>
                <div className="size-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
                  <Inbox className="size-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl sm:text-3xl font-bold text-text-strong block tracking-tight">
                  ৳
                  {paymentStats.totalPendingAmount.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  {paymentStats.actionableCount} awaiting review &bull;{" "}
                  {paymentStats.approved} approved
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs font-medium text-amber-600">
              <span>Review Payment Claims</span>
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Card>
        </Link>

        {/* Metric 3: Beneficiaries & Payroll */}
        <Link
          href="/vendors"
          className="group block focus:outline-hidden"
        >
          <Card className="p-5 bg-card border-border hover:border-primary/40 transition-all duration-200 shadow-xs hover:shadow-md h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Beneficiaries &amp; Team
                </span>
                <div className="size-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
                  <UserCheck className="size-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl sm:text-3xl font-bold text-text-strong block tracking-tight">
                  {vendorCount}
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  {employeesCount} employees &bull; {externalVendorsCount}{" "}
                  contractors
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs font-medium text-emerald-600">
              <span>Manage Receiver Accounts</span>
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Card>
        </Link>

        {/* Metric 4: International Clients */}
        <Link
          href="/clients"
          className="group block focus:outline-hidden"
        >
          <Card className="p-5 bg-card border-border hover:border-primary/40 transition-all duration-200 shadow-xs hover:shadow-md h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  International Clients
                </span>
                <div className="size-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
                  <Users className="size-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl sm:text-3xl font-bold text-text-strong block tracking-tight">
                  {clientCount}
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  Active remittance partners
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs font-medium text-purple-600">
              <span>Clients Directory</span>
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Card>
        </Link>
      </div>

      {/* Quick Workflows Grid */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground/80 uppercase tracking-wider">
          Quick Workflow Launchpad
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Link
            href="/create-invoice"
            className="group block p-4 rounded-xl bg-card border border-border hover:border-foreground/30 transition-all duration-150 shadow-2xs hover:shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <PlusSquare className="size-4" />
              </div>
              <div className="min-w-0">
                <span className="text-sm font-semibold text-text-strong block truncate group-hover:text-primary transition-colors">
                  Create Invoice
                </span>
                <span className="text-xs text-muted-foreground truncate block">
                  MT103 PDF coordinate parser
                </span>
              </div>
            </div>
          </Link>

          <Link
            href="/invoice-tools"
            className="group block p-4 rounded-xl bg-card border border-border hover:border-foreground/30 transition-all duration-150 shadow-2xs hover:shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <FileText className="size-4" />
              </div>
              <div className="min-w-0">
                <span className="text-sm font-semibold text-text-strong block truncate group-hover:text-primary transition-colors">
                  Inward Docs &amp; Form-C
                </span>
                <span className="text-xs text-muted-foreground truncate block">
                  A4 print &amp; declaration engine
                </span>
              </div>
            </div>
          </Link>

          <Link
            href="/scb-tools"
            className="group block p-4 rounded-xl bg-card border border-border hover:border-foreground/30 transition-all duration-150 shadow-2xs hover:shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <FileSpreadsheet className="size-4" />
              </div>
              <div className="min-w-0">
                <span className="text-sm font-semibold text-text-strong block truncate group-hover:text-primary transition-colors">
                  SCB Batch Generator
                </span>
                <span className="text-xs text-muted-foreground truncate block">
                  Bulk Excel &amp; payroll sheets
                </span>
              </div>
            </div>
          </Link>

          <Link
            href="/activity-logs"
            className="group block p-4 rounded-xl bg-card border border-border hover:border-foreground/30 transition-all duration-150 shadow-2xs hover:shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Clock className="size-4" />
              </div>
              <div className="min-w-0">
                <span className="text-sm font-semibold text-text-strong block truncate group-hover:text-primary transition-colors">
                  Audit Activity Logs
                </span>
                <span className="text-xs text-muted-foreground truncate block">
                  Operations &amp; MCP AI records
                </span>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* Two-Column Data Feed: Recent Inward Docs & Recent Payment Claims */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Recent Invoices */}
        <Card className="bg-card border-border shadow-xs flex flex-col justify-between">
          <CardHeader className="p-5 pb-3 border-b border-border flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              <CardTitle className="text-base font-semibold text-text-strong">
                Recent Inward Invoices
              </CardTitle>
            </div>
            <Link
              href="/invoice-tools"
              className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowRight className="size-3" />
            </Link>
          </CardHeader>

          <CardContent className="p-0 divide-y divide-border flex-1">
            {recentInvoices.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No invoices recorded yet. Click &quot;Create Invoice&quot; to
                generate one.
              </div>
            ) : (
              recentInvoices.map((inv) => {
                return (
                  <div
                    key={inv.id}
                    className="p-4 flex items-center justify-between hover:bg-muted/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-strong">
                          {inv.invoice_number}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {inv.invoice_date}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {inv.clientName || "Client"} &bull;{" "}
                        {inv.description || "Web development services"}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-semibold text-text-strong">
                        {Number(inv.amount || 0).toLocaleString()}{" "}
                        {inv.currency || "USD"}
                      </span>
                      <Link
                        href={`/invoice-tools?invoiceId=${inv.id}`}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-colors cursor-pointer"
                        title="View & Print Form-C / Bank Invoice"
                      >
                        <ArrowUpRight className="size-4" />
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>

          <CardFooter className="p-3 border-t border-border bg-muted/20">
            <Link
              href="/invoice-tools"
              className="w-full text-center text-xs font-medium text-muted-foreground hover:text-text-strong transition-colors py-1"
            >
              Open Inward Remittance Document Viewer &rarr;
            </Link>
          </CardFooter>
        </Card>

        {/* Right Column: Recent Payment Claims */}
        <Card className="bg-card border-border shadow-xs flex flex-col justify-between">
          <CardHeader className="p-5 pb-3 border-b border-border flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Inbox className="size-4 text-primary" />
              <CardTitle className="text-base font-semibold text-text-strong">
                Recent Payment Claims
              </CardTitle>
            </div>
            <Link
              href="/payment-requests"
              className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowRight className="size-3" />
            </Link>
          </CardHeader>

          <CardContent className="p-0 divide-y divide-border flex-1">
            {recentPaymentRequests.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No payment requests submitted yet. Share the public link above
                to receive claims.
              </div>
            ) : (
              recentPaymentRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-4 flex items-center justify-between hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-text-strong">
                        {req.payeeName}
                      </span>
                      {getStatusBadge(req.status)}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {req.bankName} ({req.branchName}) &bull; {req.purpose}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-semibold text-text-strong">
                      ৳{Number(req.amount || 0).toLocaleString()}
                    </span>
                    <Link
                      href="/payment-requests"
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-colors cursor-pointer"
                      title="Review claim"
                    >
                      <ArrowUpRight className="size-4" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </CardContent>

          <CardFooter className="p-3 border-t border-border bg-muted/20">
            <Link
              href="/payment-requests"
              className="w-full text-center text-xs font-medium text-muted-foreground hover:text-text-strong transition-colors py-1"
            >
              Open Payment Requests &amp; Approvals Manager &rarr;
            </Link>
          </CardFooter>
        </Card>
      </div>

      {/* Recent Activity Audit Trail */}
      {recentLogs.length > 0 && (
        <Card className="bg-card border-border shadow-xs">
          <CardHeader className="p-5 pb-3 border-b border-border flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="size-4 text-primary" />
              <CardTitle className="text-base font-semibold text-text-strong">
                Recent Operations Activity
              </CardTitle>
            </div>
            <Link
              href="/activity-logs"
              className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
            >
              <span>Full audit log</span>
              <ArrowRight className="size-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-border">
            {recentLogs.map((log) => (
              <div
                key={log.id}
                className="p-4 flex items-center justify-between hover:bg-muted/40 transition-colors"
              >
                <div className="min-w-0 flex-1 pr-3">
                  <span className="text-sm text-text-strong block font-normal truncate">
                    {log.title}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] font-medium text-primary">
                      {log.domain.replace("_", " ").toUpperCase()}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      &bull;
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {log.createdAt
                        ? format(new Date(log.createdAt), "dd MMM yyyy, HH:mm")
                        : ""}
                    </span>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] capitalize shrink-0 ${
                    log.status === "success"
                      ? "border-emerald-500/20 text-emerald-600 bg-emerald-500/10"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {log.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
