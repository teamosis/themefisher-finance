"use client";

import {
  approvePaymentRequest,
  exportPaymentRequestsToScb,
  getPaymentRequests,
  rejectPaymentRequest,
} from "@/actions";
import { Modal } from "@/components/modals/Modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { DebitAccount, PaymentRequest, PaymentRequestStatus } from "@/types";
import { format } from "date-fns";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  History,
  Info,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  X,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

interface PaymentRequestsClientProps {
  initialRequests: PaymentRequest[];
  initialDebitAccounts: DebitAccount[];
  initialStats: {
    total: number;
    pending: number;
    verified: number;
    approved: number;
    rejected: number;
    exported: number;
    actionableCount: number;
    totalPendingAmount: number;
  };
}

export default function PaymentRequestsClient({
  initialRequests,
  initialDebitAccounts,
  initialStats,
}: PaymentRequestsClientProps) {
  const [requests, setRequests] = useState<PaymentRequest[]>(initialRequests);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<
    "actionable" | "approved" | "exported" | "rejected" | "all"
  >("actionable");
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  // Public link copied state
  const [copiedLink, setCopiedLink] = useState(false);
  const [selectedDebitAccountId, setSelectedDebitAccountId] = useState<string>(
    initialDebitAccounts.find((a) => a.is_default)?.id ||
      initialDebitAccounts[0]?.id ||
      "",
  );

  // Reject modal state
  const [rejectingItem, setRejectingItem] = useState<PaymentRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Audit / Details modal state
  const [viewingItem, setViewingItem] = useState<PaymentRequest | null>(null);

  // SCB Export Success Modal state
  const [exportedResult, setExportedResult] = useState<{
    fileName: string;
    count: number;
    totalAmount: number;
  } | null>(null);

  // Quick refresh
  const handleRefresh = () => {
    startTransition(async () => {
      const refreshed = await getPaymentRequests();
      setRequests(refreshed);
      setSelectedIds([]);
    });
  };

  const handleCopyPublicLink = () => {
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://finance.themefisher.com";
    const publicUrl = `${origin}/request-payment`;
    navigator.clipboard.writeText(publicUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Filter requests
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      // Tab filter
      if (activeTab === "actionable") {
        if (req.status !== "pending" && req.status !== "verified") return false;
      } else if (activeTab !== "all") {
        if (req.status !== activeTab) return false;
      }

      // Search query filter
      if (!searchQuery.trim()) return true;
      const term = searchQuery.toLowerCase().trim();
      return (
        req.payeeName.toLowerCase().includes(term) ||
        req.trackingCode.toLowerCase().includes(term) ||
        req.bankName.toLowerCase().includes(term) ||
        req.accountNumber.includes(term) ||
        req.purpose.toLowerCase().includes(term)
      );
    });
  }, [requests, activeTab, searchQuery]);

  // Bulk selection helpers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredRequests.map((r) => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  // 1-Click Approve single request
  const handleApprove = (req: PaymentRequest, saveAsVendor = true) => {
    startTransition(async () => {
      const updated = await approvePaymentRequest(req.id, { saveAsVendor });
      setRequests((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
      );
    });
  };

  // Bulk Approve
  const handleBulkApprove = () => {
    const actionableSelected = requests.filter(
      (r) =>
        selectedIds.includes(r.id) &&
        (r.status === "pending" || r.status === "verified"),
    );
    if (actionableSelected.length === 0) return;

    startTransition(async () => {
      for (const req of actionableSelected) {
        const updated = await approvePaymentRequest(req.id, { saveAsVendor: true });
        setRequests((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item)),
        );
      }
      setSelectedIds([]);
    });
  };

  // Reject confirm
  const handleConfirmReject = () => {
    if (!rejectingItem || !rejectReason.trim()) return;
    startTransition(async () => {
      const updated = await rejectPaymentRequest(
        rejectingItem.id,
        rejectReason.trim(),
      );
      setRequests((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
      );
      setRejectingItem(null);
      setRejectReason("");
    });
  };

  // Export to SCB Straight2Bank (.xlsx)
  const handleExportScb = (requestIds: string[]) => {
    if (requestIds.length === 0) return;

    startTransition(async () => {
      try {
        const res = await exportPaymentRequestsToScb(
          requestIds,
          selectedDebitAccountId,
        );

        // Download via SheetJS in browser
        const { utils, writeFile } = await import("xlsx");
        const worksheet = utils.json_to_sheet(res.rows);
        const workbook = utils.book_new();
        utils.book_append_sheet(workbook, worksheet, "Payment Requests");
        writeFile(workbook, res.fileName);

        // Update local state
        setRequests((prev) =>
          prev.map((item) =>
            res.exportedIds.includes(item.id)
              ? {
                  ...item,
                  status: "exported",
                  exportedAt: new Date().toISOString(),
                  scbFileName: res.fileName,
                }
              : item,
          ),
        );
        setSelectedIds([]);
        setExportedResult({
          fileName: res.fileName,
          count: res.count,
          totalAmount: res.totalAmount,
        });
      } catch (err: any) {
        alert(err.message || "Failed to export SCB Straight2Bank file.");
      }
    });
  };

  // Status Badge Component
  const renderStatusBadge = (status: PaymentRequestStatus) => {
    switch (status) {
      case "pending":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-300"
          >
            <Clock className="size-3" />
            Pending Review
          </Badge>
        );
      case "verified":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-300"
          >
            <ShieldCheck className="size-3" />
            Verified & Ready
          </Badge>
        );
      case "approved":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-300"
          >
            <CheckCircle2 className="size-3" />
            Approved
          </Badge>
        );
      case "exported":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-purple-300 text-purple-700 bg-purple-50 dark:bg-purple-950/30 dark:text-purple-300"
          >
            <Check className="size-3" />
            Exported to SCB
          </Badge>
        );
      case "rejected":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950/30 dark:text-rose-300"
          >
            <XCircle className="size-3" />
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const actionableCount = useMemo(
    () =>
      requests.filter((r) => r.status === "pending" || r.status === "verified")
        .length,
    [requests],
  );

  const approvedCount = useMemo(
    () => requests.filter((r) => r.status === "approved").length,
    [requests],
  );

  const selectedApprovedIds = useMemo(() => {
    return requests
      .filter((r) => selectedIds.includes(r.id) && r.status === "approved")
      .map((r) => r.id);
  }, [requests, selectedIds]);

  return (
    <div className="space-y-6">
      {/* Page Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-strong tracking-tight flex items-center gap-2">
            <span>Payment Requests</span>
            {actionableCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                {actionableCount} new
              </span>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Review submitted beneficiary forms, verify bank routing details, and generate SCB Straight2Bank files.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyPublicLink}
            className="gap-1.5 text-xs h-9 cursor-pointer"
          >
            {copiedLink ? (
              <>
                <Check className="size-3.5 text-emerald-600" />
                <span>Link Copied</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                <span>Copy Public Form Link</span>
              </>
            )}
          </Button>

          <a
            href="/request-payment"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:opacity-90 transition-opacity"
          >
            <ExternalLink className="size-3.5" />
            <span>Open Public Form</span>
          </a>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isPending}
            className="h-9 w-9 p-0 cursor-pointer"
            title="Refresh requests"
          >
            <RefreshCw className={`size-4 ${isPending ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4 bg-card border-border shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">
              Actionable
            </span>
            <div className="size-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Clock className="size-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-text-strong">
              {actionableCount}
            </span>
            <span className="text-[11px] text-muted-foreground">claims</span>
          </div>
        </Card>

        <Card className="p-4 bg-card border-border shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">
              Approved (Ready)
            </span>
            <div className="size-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-text-strong">
              {approvedCount}
            </span>
            <span className="text-[11px] text-muted-foreground">ready for SCB</span>
          </div>
        </Card>

        <Card className="p-4 bg-card border-border shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">
              Exported
            </span>
            <div className="size-7 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <FileSpreadsheet className="size-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-text-strong">
              {requests.filter((r) => r.status === "exported").length}
            </span>
            <span className="text-[11px] text-muted-foreground">to bank</span>
          </div>
        </Card>

        <Card className="p-4 bg-card border-border shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">
              Total Submissions
            </span>
            <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <History className="size-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-text-strong">
              {requests.length}
            </span>
            <span className="text-[11px] text-muted-foreground">all-time</span>
          </div>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="bg-card border-border shadow-sm overflow-hidden">
        {/* Filter Tabs & Search Header */}
        <div className="p-4 border-b border-border bg-muted/20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setActiveTab("actionable")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0 cursor-pointer ${
                activeTab === "actionable"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-text-strong hover:bg-muted"
              }`}
            >
              Actionable ({actionableCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("approved")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0 cursor-pointer ${
                activeTab === "approved"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-text-strong hover:bg-muted"
              }`}
            >
              Approved ({approvedCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("exported")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0 cursor-pointer ${
                activeTab === "exported"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-text-strong hover:bg-muted"
              }`}
            >
              Exported ({requests.filter((r) => r.status === "exported").length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("rejected")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0 cursor-pointer ${
                activeTab === "rejected"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-text-strong hover:bg-muted"
              }`}
            >
              Rejected ({requests.filter((r) => r.status === "rejected").length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0 cursor-pointer ${
                activeTab === "all"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-text-strong hover:bg-muted"
              }`}
            >
              All ({requests.length})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search payee, bank, code..."
              className="text-xs h-8 pl-8 bg-background"
            />
          </div>
        </div>

        {/* Batch Action Bar */}
        {selectedIds.length > 0 && (
          <div className="px-4 py-2.5 bg-primary/10 border-b border-primary/20 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-text-strong">
                {selectedIds.length} item(s) selected
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* If any actionable items are selected, show Approve */}
              {requests.some(
                (r) =>
                  selectedIds.includes(r.id) &&
                  (r.status === "pending" || r.status === "verified"),
              ) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleBulkApprove}
                  disabled={isPending}
                  className="h-7 text-xs font-medium gap-1.5 cursor-pointer bg-card hover:bg-light"
                >
                  <CheckCircle2 className="size-3 text-emerald-600" />
                  <span>Approve Selected</span>
                </Button>
              )}

              {/* If any approved items are selected, show Export SCB */}
              {selectedApprovedIds.length > 0 && (
                <Button
                  size="sm"
                  onClick={() => handleExportScb(selectedApprovedIds)}
                  disabled={isPending}
                  className="h-7 text-xs font-semibold gap-1.5 cursor-pointer"
                >
                  <Download className="size-3" />
                  <span>
                    Export {selectedApprovedIds.length} to SCB Excel
                  </span>
                </Button>
              )}

              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds([])}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-text-strong"
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* Requests Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-muted-foreground font-medium">
                <th className="p-3 w-8 text-center">
                  <input
                    type="checkbox"
                    checked={
                      filteredRequests.length > 0 &&
                      filteredRequests.every((r) => selectedIds.includes(r.id))
                    }
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-border size-3.5 cursor-pointer"
                  />
                </th>
                <th className="p-3">Reference & Date</th>
                <th className="p-3">Beneficiary</th>
                <th className="p-3">Bank & Routing Details</th>
                <th className="p-3 text-right">Claim Amount</th>
                <th className="p-3">Purpose</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Inbox className="size-8 text-muted-foreground/50" />
                      <p className="text-sm font-medium">No payment requests found</p>
                      <p className="text-xs max-w-sm">
                        Share your public link to start receiving payment requests from contractors and beneficiaries.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => {
                  const isSelected = selectedIds.includes(req.id);
                  const verification = req.verificationDetails;
                  const isActionable =
                    req.status === "pending" || req.status === "verified";
                  const isApproved = req.status === "approved";

                  return (
                    <tr
                      key={req.id}
                      className={`hover:bg-muted/30 transition-colors ${
                        isSelected ? "bg-primary/5" : ""
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(req.id)}
                          className="rounded border-border size-3.5 cursor-pointer"
                        />
                      </td>

                      {/* Reference & Date */}
                      <td className="p-3 font-mono">
                        <div className="font-bold text-text-strong">
                          {req.trackingCode}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {format(new Date(req.createdAt), "dd MMM yyyy, hh:mm a")}
                        </div>
                      </td>

                      {/* Beneficiary */}
                      <td className="p-3">
                        <div className="font-semibold text-text-strong">
                          {req.payeeName}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate max-w-[160px]">
                          {req.payeeEmail || req.payeePhone || "No contact info"}
                        </div>
                        {verification?.matchedVendorName && (
                          <div className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                            <UserCheck className="size-3" />
                            <span>Registered Beneficiary</span>
                          </div>
                        )}
                      </td>

                      {/* Bank & Routing Details */}
                      <td className="p-3">
                        <div className="font-medium text-text-strong">
                          {req.bankName}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {req.branchName} Branch
                        </div>
                        <div className="font-mono text-[11px] text-text-muted mt-0.5 flex items-center gap-2">
                          <span>A/C: {req.accountNumber}</span>
                          <span className="text-muted-foreground/60">•</span>
                          <span
                            className={
                              verification?.routingValid
                                ? "text-emerald-600 font-semibold"
                                : "text-amber-600 font-semibold"
                            }
                            title={
                              verification?.routingValid
                                ? "Verified BEFTN Routing #"
                                : "Unverified routing #"
                            }
                          >
                            RTN: {req.routingNumber}
                          </span>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="p-3 text-right">
                        <div className="font-bold text-sm text-text-strong">
                          ৳{Number(req.amount).toLocaleString()}
                        </div>
                        <div className="text-[10px] text-muted-foreground uppercase">
                          {req.currency}
                        </div>
                      </td>

                      {/* Purpose */}
                      <td className="p-3 max-w-[180px]">
                        <p className="truncate text-text-default text-xs" title={req.purpose}>
                          {req.purpose}
                        </p>
                        {verification?.duplicateDetected && (
                          <div className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                            <AlertTriangle className="size-3" />
                            <span>Potential duplicate</span>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-3 text-center">
                        {renderStatusBadge(req.status)}
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Audit Details */}
                          <button
                            type="button"
                            onClick={() => setViewingItem(req)}
                            className="p-1.5 text-muted-foreground hover:text-text-strong hover:bg-light rounded-lg transition-colors cursor-pointer"
                            title="View Verification Audit"
                          >
                            <Eye className="size-4" />
                          </button>

                          {/* Actionable buttons */}
                          {isActionable && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleApprove(req, true)}
                                disabled={isPending}
                                className="h-7 px-2 text-xs font-medium text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40 border-emerald-300 cursor-pointer"
                                title="1-Click Approve"
                              >
                                <Check className="size-3.5" />
                                <span>Approve</span>
                              </Button>

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setRejectingItem(req);
                                  setRejectReason("");
                                }}
                                disabled={isPending}
                                className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                                title="Reject Request"
                              >
                                <X className="size-3.5" />
                              </Button>
                            </>
                          )}

                          {/* Approved: Export to SCB */}
                          {isApproved && (
                            <Button
                              size="sm"
                              onClick={() => handleExportScb([req.id])}
                              disabled={isPending}
                              className="h-7 px-2.5 text-xs font-semibold gap-1.5 cursor-pointer bg-primary text-primary-foreground"
                              title="Download SCB Straight2Bank Bulk Excel"
                            >
                              <Download className="size-3" />
                              <span>SCB Excel</span>
                            </Button>
                          )}

                          {/* Exported info */}
                          {req.status === "exported" && (
                            <span
                              className="text-[10px] text-muted-foreground font-mono truncate max-w-[100px]"
                              title={req.scbFileName || "Exported"}
                            >
                              {req.scbFileName ? "Downloaded" : "Exported"}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Reject Modal */}
      {rejectingItem && (
        <Modal
          isOpen={true}
          onClose={() => setRejectingItem(null)}
          title="Reject Payment Request"
          subtitle={`Reject request ${rejectingItem.trackingCode} from ${rejectingItem.payeeName}`}
          icon={<AlertCircle className="size-5 text-destructive" />}
          maxWidth="md"
        >
          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-strong">
                Reason for Rejection <span className="text-destructive">*</span>
              </label>
              <Textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Invalid account number provided, or unapproved amount."
                className="text-xs resize-none bg-background"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRejectingItem(null)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleConfirmReject}
                disabled={!rejectReason.trim() || isPending}
                className="text-xs font-semibold gap-1.5 cursor-pointer"
              >
                {isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                <span>Confirm Rejection</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Audit / Details Modal */}
      {viewingItem && (
        <Modal
          isOpen={true}
          onClose={() => setViewingItem(null)}
          title={`Audit Details: ${viewingItem.trackingCode}`}
          subtitle={`Submitted on ${format(new Date(viewingItem.createdAt), "dd MMM yyyy, hh:mm a")}`}
          icon={<ShieldCheck className="size-5 text-primary" />}
          maxWidth="lg"
        >
          <div className="p-6 space-y-4 text-xs">
            {/* Beneficiary & Bank Summary */}
            <div className="grid grid-cols-2 gap-3 p-3.5 bg-muted/40 rounded-xl border border-border">
              <div>
                <span className="text-muted-foreground text-[10px] uppercase font-bold block">
                  Beneficiary
                </span>
                <span className="font-bold text-sm text-text-strong block mt-0.5">
                  {viewingItem.payeeName}
                </span>
                <span className="text-muted-foreground block text-[11px]">
                  {viewingItem.payeeEmail || viewingItem.payeePhone || "No contact"}
                </span>
              </div>
              <div className="text-right">
                <span className="text-muted-foreground text-[10px] uppercase font-bold block">
                  Claimed Amount
                </span>
                <span className="font-bold text-base text-emerald-600 dark:text-emerald-400 block mt-0.5">
                  ৳{Number(viewingItem.amount).toLocaleString()} BDT
                </span>
                <span className="text-muted-foreground block text-[11px]">
                  Status: {viewingItem.status}
                </span>
              </div>
            </div>

            {/* Bank details */}
            <div className="border border-border rounded-xl p-3.5 space-y-2">
              <div className="font-semibold text-text-strong pb-1 border-b border-border/50">
                Bank & Account Coordinates
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Bank</span>
                  <span className="font-medium text-text-strong">{viewingItem.bankName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Branch</span>
                  <span className="font-medium text-text-strong">{viewingItem.branchName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Account Number</span>
                  <span className="font-mono font-semibold text-text-strong">
                    {viewingItem.accountNumber}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">BEFTN Routing Number</span>
                  <span className="font-mono font-semibold text-text-strong">
                    {viewingItem.routingNumber}
                  </span>
                </div>
              </div>
            </div>

            {/* Purpose */}
            <div className="border border-border rounded-xl p-3.5 space-y-1">
              <span className="font-semibold text-text-strong block">Purpose / Reason</span>
              <p className="text-text-default text-xs leading-relaxed">{viewingItem.purpose}</p>
            </div>

            {/* Verification Checklist */}
            <div className="border border-border rounded-xl p-3.5 space-y-2.5">
              <span className="font-semibold text-text-strong block">Automated Verification Checklist</span>

              <div className="space-y-1.5 text-xs">
                {viewingItem.verificationDetails?.notes &&
                viewingItem.verificationDetails.notes.length > 0 ? (
                  viewingItem.verificationDetails.notes.map((note, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-text-default">
                      <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{note}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-muted-foreground">No verification notes recorded.</div>
                )}

                {viewingItem.verificationDetails?.duplicateDetected && (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs mt-2">
                    <span className="font-bold block">Duplicate Warning:</span>
                    Found {viewingItem.verificationDetails.duplicateRequests?.length} previous
                    request(s) with this account number in the last 30 days.
                  </div>
                )}
              </div>
            </div>

            {viewingItem.rejectionReason && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 rounded-xl">
                <span className="font-bold block">Rejection Reason:</span>
                <span>{viewingItem.rejectionReason}</span>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setViewingItem(null)}
                className="text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* SCB Excel Generated Success Modal */}
      {exportedResult && (
        <Modal
          isOpen={true}
          onClose={() => setExportedResult(null)}
          title="SCB Straight2Bank File Ready!"
          icon={<CheckCircle2 className="size-6 text-primary" />}
          maxWidth="md"
        >
          <div className="p-6 text-center flex flex-col items-center gap-4">
            <div className="size-12 bg-primary/10 rounded-full flex items-center justify-center">
              <FileSpreadsheet className="size-6 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-bold text-text-strong">
                Excel File Downloaded
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Successfully exported {exportedResult.count} payment request(s) totaling{" "}
                <span className="font-bold text-text-strong">
                  ৳{Number(exportedResult.totalAmount).toLocaleString()} BDT
                </span>
                . Please upload the generated file to the Standard Chartered Straight2Bank portal.
              </p>
            </div>

            <div className="p-3 bg-muted rounded-xl border border-border w-full text-center font-mono text-xs text-text-strong truncate">
              {exportedResult.fileName}
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5 w-full">
              <a
                href="https://s2b.standardchartered.com/unifiedlogin/login/index.html?language=en_AE#/login"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setExportedResult(null)}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity w-full text-xs"
              >
                <span>Go to SCB Straight2Bank</span>
                <ExternalLink className="size-3.5" />
              </a>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setExportedResult(null)}
                className="w-full text-xs h-9 cursor-pointer"
              >
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Inbox(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}
