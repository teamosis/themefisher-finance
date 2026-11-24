"use client";

import { getActivityLogs } from "@/actions/activity-logs";
import { Modal } from "@/components/modals/modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ActivityAction, ActivityLog, ActivityLogDetails } from "@/types";
import { format, formatDistanceToNow, isValid, parseISO } from "date-fns";
import {
  Activity,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  KeyRound,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

interface ActivityLogsClientProps {
  initialLogs: ActivityLog[];
  initialTotal: number;
}

function formatLogTimestamp(timestamp: string | Date | undefined) {
  if (!timestamp) return { relative: "Just now", exact: "" };
  try {
    const date =
      typeof timestamp === "string" ? parseISO(timestamp) : timestamp;
    if (!isValid(date))
      return { relative: "Recently", exact: String(timestamp) };
    return {
      relative: formatDistanceToNow(date, { addSuffix: true }),
      exact: format(date, "dd/MM/yyyy HH:mm:ss"),
    };
  } catch {
    return { relative: "Recently", exact: "" };
  }
}

function getActionBadge(action: ActivityAction) {
  if (action === "excel_export_transfers" || action === "excel_export_salary") {
    return {
      label:
        action === "excel_export_salary"
          ? "Salary Sheet Excel"
          : "Transfers Excel",
      icon: FileSpreadsheet,
      badgeClass:
        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    };
  }
  if (action.startsWith("invoice_")) {
    return {
      label: "Invoice",
      icon: FileText,
      badgeClass:
        "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    };
  }
  if (action.startsWith("vendor_")) {
    return {
      label: action === "vendor_archive" ? "Vendor Archived" : "Vendor",
      icon: Users,
      badgeClass:
        "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    };
  }
  if (action.startsWith("debit_account_")) {
    return {
      label: "Debit Account",
      icon: CreditCard,
      badgeClass:
        "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    };
  }
  if (action.startsWith("client_")) {
    return {
      label: "Client",
      icon: Building2,
      badgeClass:
        "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
    };
  }
  return {
    label: action,
    icon: Activity,
    badgeClass: "bg-muted text-muted-foreground border-border",
  };
}

export default function ActivityLogsClient({
  initialLogs,
  initialTotal,
}: ActivityLogsClientProps) {
  const [logs, setLogs] = useState<ActivityLog[]>(initialLogs);
  const [, setTotal] = useState<number>(initialTotal);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const refreshLogs = async () => {
    setLoading(true);
    try {
      const res = await getActivityLogs({ limit: 100 });
      setLogs(res.rows);
      setTotal(res.total);
    } catch (err) {
      console.error("Error refreshing activity logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        query === "" ||
        log.title.toLowerCase().includes(query) ||
        (log.entityId && log.entityId.toLowerCase().includes(query)) ||
        (log.details?.fileName &&
          log.details.fileName.toLowerCase().includes(query)) ||
        (log.details?.reason &&
          log.details.reason.toLowerCase().includes(query)) ||
        (log.details?.debitAccount &&
          log.details.debitAccount.toLowerCase().includes(query));

      const matchesDomain =
        domainFilter === "all" || log.domain === domainFilter;

      const matchesAction =
        actionFilter === "all" ||
        (actionFilter === "excel" &&
          (log.action === "excel_export_transfers" ||
            log.action === "excel_export_salary")) ||
        (actionFilter === "invoices" && log.action.startsWith("invoice_")) ||
        (actionFilter === "vendors" && log.action.startsWith("vendor_")) ||
        (actionFilter === "accounts" &&
          log.action.startsWith("debit_account_"));

      return matchesSearch && matchesDomain && matchesAction;
    });
  }, [logs, searchQuery, domainFilter, actionFilter]);

  const handleRedownloadExcel = async (
    details: ActivityLogDetails | null | undefined,
  ) => {
    if (!details || !details.items || details.items.length === 0) {
      alert("No row items snapshot available for this export.");
      return;
    }

    setIsExportingExcel(true);
    try {
      const { utils, writeFile } = await import("xlsx");
      const rows = details.items.map((item) => ({
        "Customer Reference": "",
        "Beneficiary Name(120)": item.beneficiaryName,
        "Beneficiary Account Number": item.accountNumber,
        "Routing Number": item.routingNumber,
        "Payment Amount": item.amount,
        "Reason(140)": item.reason || details.reason || "",
        "Date(DD/MM/YYYY)": format(new Date(), "dd/MM/yyyy"),
        "Debit Account Number(Prefix- 00 BDT)": (
          details.debitAccount || ""
        ).trim(),
        "Beneficiary Email ID(Optional)": "",
      }));

      const worksheet = utils.json_to_sheet(rows);
      const workbook = utils.book_new();
      utils.book_append_sheet(
        workbook,
        worksheet,
        details.sheetName || "Sheet1",
      );
      const fileName =
        details.fileName ||
        `SCB_Export_${format(new Date(), "yyyyMMdd_HHmmss")}.xlsx`;
      writeFile(workbook, fileName);
    } catch (err) {
      console.error("Failed to re-generate Excel:", err);
      alert("Could not re-generate the Excel file. Please try again.");
    } finally {
      setIsExportingExcel(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-strong">
            App Activity Logs
          </h1>
          <p className="text-sm text-text-muted">
            Complete audit trail of SCB bulk transfer Excels, salary sheets,
            invoices, and bank operations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/settings/mcp-logs">
            <Button variant="outline" className="gap-2 text-xs h-9">
              <KeyRound className="size-3.5" />
              <span>MCP Agent Logs</span>
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={refreshLogs}
            disabled={loading}
            className="gap-2 text-xs h-9 shrink-0"
          >
            <RefreshCw
              className={`size-3.5 ${loading ? "animate-spin" : ""}`}
            />
            <span>Refresh Logs</span>
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border">
        <div className="relative flex-1 max-w-md">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by action, filename, or account..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => {
              setDomainFilter("all");
              setActionFilter("all");
            }}
            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              domainFilter === "all" && actionFilter === "all"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-text-strong hover:bg-muted"
            }`}
          >
            All ({logs.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setDomainFilter("scb_tools");
              setActionFilter("excel");
            }}
            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              actionFilter === "excel"
                ? "bg-emerald-600 text-white"
                : "text-muted-foreground hover:text-text-strong hover:bg-muted"
            }`}
          >
            <FileSpreadsheet className="size-3" />
            <span>Excel Exports</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setDomainFilter("scb_tools");
              setActionFilter("all");
            }}
            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              domainFilter === "scb_tools" && actionFilter !== "excel"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-text-strong hover:bg-muted"
            }`}
          >
            <Users className="size-3" />
            <span>SCB Tools</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setDomainFilter("invoice_tools");
              setActionFilter("all");
            }}
            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              domainFilter === "invoice_tools"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-text-strong hover:bg-muted"
            }`}
          >
            <FileText className="size-3" />
            <span>Invoice Tools</span>
          </button>
        </div>
      </div>

      {/* Main Logs Table / List */}
      <Card className="border-border bg-card shadow-xs overflow-hidden">
        <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-text-strong">
              Activity History
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Showing {filteredLogs.length} events
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredLogs.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center justify-center gap-3">
              <div className="size-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
                <Clock className="size-6" />
              </div>
              <p className="text-sm font-medium text-text-strong">
                No activity logs found
              </p>
              <p className="text-xs text-muted-foreground max-w-sm">
                Generated Excel files, invoices, and bank operations will
                automatically appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredLogs.map((log) => {
                const badge = getActionBadge(log.action);
                const Icon = badge.icon;
                const time = formatLogTimestamp(log.createdAt);
                const isExcel =
                  log.action === "excel_export_transfers" ||
                  log.action === "excel_export_salary";

                return (
                  <div
                    key={log.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/40 transition-colors cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                  >
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <div
                        className={`size-10 rounded-xl flex items-center justify-center shrink-0 border ${badge.badgeClass}`}
                      >
                        <Icon className="size-5" />
                      </div>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-text-strong leading-tight">
                            {log.title}
                          </span>
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded-md border font-medium ${badge.badgeClass}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span title={time.exact}>{time.relative}</span>
                          {log.details?.fileName && (
                            <span className="truncate font-mono text-[11px] bg-muted px-1.5 py-0.2 rounded text-text-strong">
                              {log.details.fileName}
                            </span>
                          )}
                          {log.details?.debitAccount && (
                            <span className="hidden md:inline truncate">
                              Debit: {log.details.debitAccount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                      {isExcel && log.details?.totalAmount ? (
                        <div className="text-right">
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block">
                            ৳{Number(log.details.totalAmount).toLocaleString()}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {log.details.itemCount} payees
                          </span>
                        </div>
                      ) : null}

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLog(log);
                        }}
                      >
                        <Eye className="size-3.5" />
                        <span>Details</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      {selectedLog && (
        <Modal
          isOpen={Boolean(selectedLog)}
          onClose={() => setSelectedLog(null)}
          title={selectedLog.title}
          subtitle={`Logged on ${formatLogTimestamp(selectedLog.createdAt).exact}`}
          icon={
            selectedLog.action.includes("excel") ? (
              <FileSpreadsheet className="size-5 text-emerald-600" />
            ) : (
              <Activity className="size-5 text-primary" />
            )
          }
          maxWidth="3xl"
        >
          <div className="p-6 flex flex-col gap-6">
            {/* Metadata Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-muted/50 rounded-xl border border-border text-xs">
              <div>
                <span className="text-muted-foreground block">Domain:</span>
                <span className="font-semibold text-text-strong capitalize">
                  {selectedLog.domain.replace("_", " ")}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Action:</span>
                <span className="font-semibold text-text-strong font-mono">
                  {selectedLog.action}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Status:</span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                  <CheckCircle2 className="size-3" />
                  {selectedLog.status}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Client IP:</span>
                <span className="font-mono text-text-strong">
                  {selectedLog.ipAddress || "Localhost"}
                </span>
              </div>
            </div>

            {/* Excel Breakdown Section */}
            {selectedLog.details?.items &&
            selectedLog.details.items.length > 0 ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-text-strong">
                      Exported Payee Breakdown (
                      {selectedLog.details.items.length} items)
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Debit Account: {selectedLog.details.debitAccount || "N/A"}{" "}
                      • Total: ৳
                      {Number(
                        selectedLog.details.totalAmount || 0,
                      ).toLocaleString()}{" "}
                      BDT
                    </p>
                  </div>

                  <Button
                    onClick={() => handleRedownloadExcel(selectedLog.details)}
                    disabled={isExportingExcel}
                    className="gap-2 text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                  >
                    <Download className="size-3.5" />
                    <span>
                      {isExportingExcel
                        ? "Generating..."
                        : "Re-download Excel (.xlsx)"}
                    </span>
                  </Button>
                </div>

                <div className="border border-border rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted text-muted-foreground border-b border-border sticky top-0">
                      <tr>
                        <th className="p-2.5 font-medium">Beneficiary</th>
                        <th className="p-2.5 font-medium">Account No.</th>
                        <th className="p-2.5 font-medium">
                          Bank &amp; Routing
                        </th>
                        <th className="p-2.5 font-medium text-right">
                          Amount (BDT)
                        </th>
                        <th className="p-2.5 font-medium">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {selectedLog.details.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-muted/30">
                          <td className="p-2.5 font-medium text-text-strong">
                            {item.beneficiaryName}
                            {item.isEmployee && (
                              <Badge
                                variant="outline"
                                className="ml-1 text-[10px] py-0"
                              >
                                Staff
                              </Badge>
                            )}
                          </td>
                          <td className="p-2.5 font-mono text-muted-foreground">
                            {item.accountNumber}
                          </td>
                          <td className="p-2.5 text-muted-foreground">
                            {item.bankName || "Bank"} • {item.routingNumber}
                          </td>
                          <td className="p-2.5 text-right font-bold text-text-strong font-mono">
                            ৳{Number(item.amount).toLocaleString()}
                          </td>
                          <td className="p-2.5 text-muted-foreground truncate max-w-xs">
                            {item.reason || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : selectedLog.details?.extra ? (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-bold text-text-strong">
                  Event Data Payload
                </h3>
                <pre className="p-4 bg-muted/60 rounded-xl border border-border text-xs font-mono overflow-x-auto text-text-strong">
                  {JSON.stringify(selectedLog.details.extra, null, 2)}
                </pre>
              </div>
            ) : null}

            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => setSelectedLog(null)}
                className="text-xs h-9"
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
