"use client";

import { logExcelExport } from "@/actions";
import SearchableVendorSelect from "@/components/forms/searchable-vendor-select";
import { ConfirmDeleteModal } from "@/components/modals/confirm-delete-modal";
import { Modal } from "@/components/modals/modal";
import { Button } from "@/components/ui/button";
import { buildScbWorkbook, formatTransferDate, isPaymentAmount } from "@/lib/scb-workbook";
import type { ActivityExcelItem, DebitAccount, Vendor } from "@/types";
import { format } from "date-fns";
import {
  ArrowRight,
  Briefcase,
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Layers,
  Plus,
  RotateCcw,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

type TransferRow = {
  id: string;
  vendorId: string | null;
  amount: string;
  description: string;
  transferDate: string;
};

type EmployeeSalaryRow = {
  vendorId: string;
  vendor: Vendor;
  selected: boolean;
  amount: string;
};

type AdditionalSalaryRow = {
  id: string;
  vendorId: string | null;
  amount: string;
  description: string;
};

function isPayableVendor(vendor: Vendor | undefined): vendor is Vendor {
  return Boolean(
    vendor &&
    !vendor.is_hidden &&
    vendor.account_number.trim() &&
    /^\d{9}$/.test(vendor.routing_number),
  );
}

async function downloadScbWorkbook(
  rows: Record<string, string>[],
  sheetName: string,
  filePrefix: string,
): Promise<string> {
  const { xlsx, workbook } = await buildScbWorkbook(rows, sheetName);
  const fileName = `${filePrefix}_${format(new Date(), "yyyyMMdd_HHmmss")}.xlsx`;
  xlsx.writeFile(workbook, fileName);
  return fileName;
}

export default function ScbToolsClient({
  initialVendors,
  initialDebitAccounts,
}: {
  initialVendors: Vendor[];
  initialDebitAccounts: DebitAccount[];
}) {
  const vendors = initialVendors;
  const [rows, setRows] = useState<TransferRow[]>([
    {
      id: "1",
      vendorId: "",
      amount: "",
      description: "",
      transferDate: format(new Date(), "yyyy-MM-dd"),
    },
  ]);
  const debitAccounts = initialDebitAccounts;
  const initialDebit =
    debitAccounts.find((account) => account.is_default)?.account_number ?? "";
  const [debitAccount, setDebitAccount] = useState(initialDebit);

  // Salary Sheet Modal State
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [salaryDate, setSalaryDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [salaryReason, setSalaryReason] = useState<string>(
    `Salary for ${format(new Date(), "MMMM yyyy")}`,
  );
  const [salaryDebitAccount, setSalaryDebitAccount] = useState<string>("");
  const [employeeSalaryRows, setEmployeeSalaryRows] = useState<
    EmployeeSalaryRow[]
  >([]);
  const [additionalSalaryRows, setAdditionalSalaryRows] = useState<
    AdditionalSalaryRow[]
  >([]);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  // SCB Popup State
  const [showScbPopup, setShowScbPopup] = useState(false);

  const handleDebitAccountChange = (value: string) => {
    setDebitAccount(value);
    setSalaryDebitAccount(value);
  };

  // Filter employees
  const employeeVendors = useMemo(
    () => vendors.filter((v) => v.is_employee && !v.is_hidden),
    [vendors],
  );

  // Initialize employee rows when opening Salary Modal
  const handleOpenSalaryModal = () => {
    setSalaryDebitAccount(debitAccount);
    setSalaryDate(format(new Date(), "yyyy-MM-dd"));
    setSalaryReason(`Salary for ${format(new Date(), "MMMM yyyy")}`);

    const initialRows: EmployeeSalaryRow[] = employeeVendors.map((emp) => ({
      vendorId: emp.id,
      vendor: emp,
      selected: true,
      amount: emp.salary ? String(emp.salary) : "",
    }));

    setEmployeeSalaryRows(initialRows);
    setAdditionalSalaryRows([]);
    setShowSalaryModal(true);
  };

  const addRow = () => {
    setRows([
      ...rows,
      {
        id: crypto.randomUUID(),
        vendorId: null,
        amount: "",
        description: "",
        transferDate: "",
      },
    ]);
  };

  const removeRow = (id: string) => {
    if (rows.length > 1) {
      setRows(rows.filter((r) => r.id !== id));
    }
  };

  const handleRowChange = (
    id: string,
    field: keyof TransferRow,
    value: string | null,
  ) => {
    setRows(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  const handleReset = () => {
    const hasData =
      rows.some(
        (r) => r.vendorId || r.amount || r.description || r.transferDate,
      ) || rows.length > 1;
    if (hasData) {
      setIsResetModalOpen(true);
    } else {
      executeReset();
    }
  };

  const executeReset = () => {
    setRows([
      {
        id: crypto.randomUUID(),
        vendorId: null,
        amount: "",
        description: "",
        transferDate: "",
      },
    ]);
    setIsResetModalOpen(false);
  };

  // Standard Excel Generation for manual rows
  const handleGenerateExcel = async () => {
    const filledRows = rows.filter(
      (row) => row.vendorId || row.amount || row.description,
    );
    if (!filledRows.length) {
      alert("Add at least one transfer before exporting.");
      return;
    }

    if (!debitAccount.trim()) {
      alert(
        "Please enter or select a Debit Account Number before generating the Excel file.",
      );
      return;
    }

    const excelData: Record<string, string>[] = [];
    for (const [index, row] of filledRows.entries()) {
      const vendor = vendors.find((item) => item.id === row.vendorId);
      const formattedDate = formatTransferDate(row.transferDate);
      if (
        !isPayableVendor(vendor) ||
        !formattedDate ||
        !isPaymentAmount(row.amount)
      ) {
        alert(
          `Check the receiver, routing number, date, and amount for transfer #${index + 1}.`,
        );
        return;
      }
      excelData.push({
        "Customer Reference": "",
        "Beneficiary Name(120)": vendor.receiver_name,
        "Beneficiary Account Number": vendor.account_number,
        "Routing Number": vendor.routing_number,
        "Payment Amount": row.amount,
        "Reason(140)": row.description,
        "Date(DD/MM/YYYY)": formattedDate,
        "Debit Account Number(Prefix- 00 BDT)": debitAccount.trim(),
        "Beneficiary Email ID(Optional)": "",
      });
    }

    let generatedFileName = "";
    try {
      generatedFileName = await downloadScbWorkbook(
        excelData,
        "Transfers",
        "SCB_Transfers",
      );
    } catch {
      alert("Could not generate the Excel file. Please try again.");
      return;
    }

    const transferItems: ActivityExcelItem[] = filledRows.map((row) => {
      const vendor = vendors.find((item) => item.id === row.vendorId)!;
      return {
        beneficiaryName: vendor.receiver_name,
        accountNumber: vendor.account_number,
        bankName: vendor.bank_name,
        branchName: vendor.branch_name,
        routingNumber: vendor.routing_number,
        amount: row.amount,
        reason: row.description,
        isEmployee: vendor.is_employee || false,
      };
    });

    const totalTransferAmount = filledRows.reduce(
      (sum, r) => sum + Number(r.amount),
      0,
    );

    try {
      await logExcelExport({
        type: "transfers",
        fileName: generatedFileName,
        sheetName: "Transfers",
        totalAmount: totalTransferAmount,
        currency: "BDT",
        itemCount: filledRows.length,
        debitAccount: debitAccount.trim(),
        reason: filledRows[0]?.description || "SCB Bulk Transfers",
        items: transferItems,
      });
    } catch (logErr) {
      console.error("Failed to log SCB transfers export:", logErr);
    }

    setShowScbPopup(true);
  };

  // Salary Sheet Actions
  const handleToggleAllEmployees = (selectAll: boolean) => {
    setEmployeeSalaryRows((prev) =>
      prev.map((r) => ({ ...r, selected: selectAll })),
    );
  };

  const handleToggleEmployeeRow = (vendorId: string) => {
    setEmployeeSalaryRows((prev) =>
      prev.map((r) =>
        r.vendorId === vendorId ? { ...r, selected: !r.selected } : r,
      ),
    );
  };

  const handleSalaryAmountChange = (vendorId: string, amount: string) => {
    setEmployeeSalaryRows((prev) =>
      prev.map((r) => (r.vendorId === vendorId ? { ...r, amount } : r)),
    );
  };

  // Additional Transactions in Salary Sheet Modal
  const handleAddAdditionalSalaryRow = () => {
    setAdditionalSalaryRows((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        vendorId: null,
        amount: "",
        description: "",
      },
    ]);
  };

  const handleRemoveAdditionalSalaryRow = (id: string) => {
    setAdditionalSalaryRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleAdditionalSalaryRowChange = (
    id: string,
    field: keyof AdditionalSalaryRow,
    value: string | null,
  ) => {
    setAdditionalSalaryRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );
  };

  const selectedSalaryRows = useMemo(
    () => employeeSalaryRows.filter((r) => r.selected),
    [employeeSalaryRows],
  );

  const employeeSubtotal = useMemo(() => {
    return selectedSalaryRows.reduce(
      (sum, r) => sum + (Number(r.amount) || 0),
      0,
    );
  }, [selectedSalaryRows]);

  const additionalSubtotal = useMemo(() => {
    return additionalSalaryRows.reduce(
      (sum, r) => sum + (Number(r.amount) || 0),
      0,
    );
  }, [additionalSalaryRows]);

  const grandTotalPayout = employeeSubtotal + additionalSubtotal;

  // Export Salary Sheet directly to Excel
  const handleDownloadSalaryExcel = async () => {
    const totalSelected =
      selectedSalaryRows.length + additionalSalaryRows.length;
    if (totalSelected === 0) {
      alert(
        "Please select at least one employee or add an additional transaction.",
      );
      return;
    }

    const missingAmount = selectedSalaryRows.some(
      (row) => !isPaymentAmount(row.amount) || !isPayableVendor(row.vendor),
    );
    if (missingAmount) {
      alert(
        "Check the salary amount and banking details for all selected employees.",
      );
      return;
    }

    for (let i = 0; i < additionalSalaryRows.length; i++) {
      const row = additionalSalaryRows[i];
      const vendor = vendors.find((item) => item.id === row.vendorId);
      if (!isPayableVendor(vendor)) {
        alert(
          `Check the receiver and routing number for additional transaction #${i + 1}.`,
        );
        return;
      }
      if (!isPaymentAmount(row.amount)) {
        alert(
          `Please enter a valid payment amount for additional transaction #${i + 1}.`,
        );
        return;
      }
    }

    const activeDebit = salaryDebitAccount || debitAccount;
    if (!activeDebit.trim()) {
      alert("Please select a Debit Account Number for salary payout.");
      return;
    }

    const formattedDate = formatTransferDate(salaryDate);
    if (!formattedDate) {
      alert("Enter a valid salary payment date.");
      return;
    }

    const employeeExcelData = selectedSalaryRows.map((row) => ({
      "Customer Reference": "",
      "Beneficiary Name(120)": row.vendor.receiver_name,
      "Beneficiary Account Number": row.vendor.account_number,
      "Routing Number": row.vendor.routing_number,
      "Payment Amount": row.amount,
      "Reason(140)":
        salaryReason || `Salary for ${format(new Date(), "MMMM yyyy")}`,
      "Date(DD/MM/YYYY)": formattedDate,
      "Debit Account Number(Prefix- 00 BDT)": activeDebit.trim(),
      "Beneficiary Email ID(Optional)": "",
    }));

    const additionalExcelData = additionalSalaryRows.map((row) => {
      const vendor = vendors.find((v) => v.id === row.vendorId)!;
      return {
        "Customer Reference": "",
        "Beneficiary Name(120)": vendor.receiver_name,
        "Beneficiary Account Number": vendor.account_number,
        "Routing Number": vendor.routing_number,
        "Payment Amount": row.amount,
        "Reason(140)": row.description || salaryReason || "Additional Payout",
        "Date(DD/MM/YYYY)": formattedDate,
        "Debit Account Number(Prefix- 00 BDT)": activeDebit.trim(),
        "Beneficiary Email ID(Optional)": "",
      };
    });

    const combinedExcelData = [...employeeExcelData, ...additionalExcelData];

    let generatedSalaryFileName = "";
    try {
      generatedSalaryFileName = await downloadScbWorkbook(
        combinedExcelData,
        "Salary Sheet",
        "SCB_Salary_Sheet",
      );
    } catch {
      alert("Could not generate the Excel file. Please try again.");
      return;
    }

    const salaryItems: ActivityExcelItem[] = [
      ...selectedSalaryRows.map((r) => ({
        beneficiaryName: r.vendor.receiver_name,
        accountNumber: r.vendor.account_number,
        bankName: r.vendor.bank_name,
        branchName: r.vendor.branch_name,
        routingNumber: r.vendor.routing_number,
        amount: r.amount,
        reason: salaryReason || `Salary for ${format(new Date(), "MMMM yyyy")}`,
        isEmployee: true,
      })),
      ...additionalSalaryRows.map((r) => {
        const v = vendors.find((vend) => vend.id === r.vendorId)!;
        return {
          beneficiaryName: v.receiver_name,
          accountNumber: v.account_number,
          bankName: v.bank_name,
          branchName: v.branch_name,
          routingNumber: v.routing_number,
          amount: r.amount,
          reason: r.description || salaryReason || "Additional Payout",
          isEmployee: v.is_employee || false,
        };
      }),
    ];

    try {
      await logExcelExport({
        type: "salary",
        fileName: generatedSalaryFileName,
        sheetName: "Salary Sheet",
        totalAmount: grandTotalPayout,
        currency: "BDT",
        itemCount: combinedExcelData.length,
        debitAccount: activeDebit.trim(),
        reason: salaryReason || `Salary for ${format(new Date(), "MMMM yyyy")}`,
        items: salaryItems,
      });
    } catch (logErr) {
      console.error("Failed to log SCB salary sheet export:", logErr);
    }

    setShowSalaryModal(false);
    setShowScbPopup(true);
    setBannerMessage(
      `Successfully generated salary sheet Excel for ${combinedExcelData.length} transactions (Total: ৳${grandTotalPayout.toLocaleString()})!`,
    );
    setTimeout(() => setBannerMessage(null), 5000);
  };

  const handleLoadEmployeesIntoTable = () => {
    const totalCount = selectedSalaryRows.length + additionalSalaryRows.length;
    if (totalCount === 0) {
      alert(
        "Please select at least one employee or add an additional transaction.",
      );
      return;
    }

    const empRows: TransferRow[] = selectedSalaryRows.map((r) => ({
      id: crypto.randomUUID(),
      vendorId: r.vendorId,
      amount: r.amount || "",
      description:
        salaryReason || `Salary for ${format(new Date(), "MMMM yyyy")}`,
      transferDate: salaryDate,
    }));

    const addRows: TransferRow[] = additionalSalaryRows
      .filter((r) => r.vendorId)
      .map((r) => ({
        id: crypto.randomUUID(),
        vendorId: r.vendorId,
        amount: r.amount || "",
        description: r.description || salaryReason || "Payout",
        transferDate: salaryDate,
      }));

    const combinedRows = [...empRows, ...addRows];
    setRows(combinedRows);
    setShowSalaryModal(false);
    setBannerMessage(
      `Loaded ${combinedRows.length} transfers into the generator table.`,
    );
    setTimeout(() => setBannerMessage(null), 5000);
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6 pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-strong">
            SCB Transaction Generator
          </h1>
          <p className="text-sm text-text-muted">
            Generate Standard Chartered Bank bulk payout Excel files and monthly
            salary sheets.
          </p>
        </div>

        {/* Action Header Button: Create Salary Sheet */}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={handleOpenSalaryModal}
            className="gap-2 cursor-pointer"
          >
            <Briefcase className="size-4" />
            <span>Create Salary Sheet</span>
          </Button>
        </div>
      </div>

      {/* Success / Info Banner */}
      {bannerMessage && (
        <div className="bg-success/10 border border-success/20 text-success px-4 py-3 rounded-xl flex items-center justify-between shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2 font-medium text-xs sm:text-sm">
            <Check className="size-4 shrink-0 text-success" />
            <span>{bannerMessage}</span>
          </div>
          <button
            onClick={() => setBannerMessage(null)}
            className="text-success hover:opacity-75 p-1 rounded-lg cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Debit Account Dropdown Selector */}
      <div className="bg-card rounded-2xl shadow-xs border border-border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <label
            htmlFor="debit-account"
            className="block text-sm font-normal text-text-strong"
          >
            SCB Debit Account Number *
          </label>
          <p className="text-xs text-text-muted mt-0.5">
            Funding account debited for transfers. Loaded automatically from
            your database.
          </p>
        </div>
        <div className="w-full sm:w-80">
          <select
            id="debit-account"
            required
            value={debitAccount}
            onChange={(e) => handleDebitAccountChange(e.target.value)}
            className="w-full border border-input rounded-xl px-3.5 py-2.5 pr-10 font-mono text-sm bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 shadow-xs cursor-pointer min-h-11"
          >
            {debitAccounts.length > 0 ? (
              debitAccounts.map((acc) => (
                <option key={acc.id} value={acc.account_number}>
                  {acc.account_number} —{" "}
                  {acc.account_label || acc.bank_name || "SCB"}{" "}
                  {acc.is_default ? "★" : ""}
                </option>
              ))
            ) : debitAccount ? (
              <option value={debitAccount}>
                {debitAccount} (Default Account)
              </option>
            ) : (
              <option value="">-- Select Debit Account --</option>
            )}
          </select>
        </div>
      </div>

      {/* Main Generator Grid */}
      <div className="bg-card rounded-2xl shadow-xs border border-border p-4 sm:p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          {rows.map((row, index) => (
            <div
              key={row.id}
              className="p-3.5 sm:p-4 border border-border rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors flex flex-col gap-3"
            >
              {/* Mobile Header for this row */}
              <div className="flex items-center justify-between md:hidden pb-2 border-b border-border/60">
                <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
                  Transfer #{index + 1}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRow(row.id)}
                  disabled={rows.length === 1}
                  className="size-8 text-destructive hover:bg-destructive/10"
                  title="Remove Transfer"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 sm:gap-4 items-start">
                {/* Vendor Selection */}
                <div className="sm:col-span-2 md:col-span-4">
                  <label className="block text-xs font-medium text-text-strong mb-1.5">
                    Receiver *
                  </label>
                  <SearchableVendorSelect
                    vendors={vendors}
                    value={row.vendorId}
                    onChange={(val) => handleRowChange(row.id, "vendorId", val)}
                    placeholder="Search receiver..."
                  />
                </div>

                {/* Amount */}
                <div className="sm:col-span-1 md:col-span-2">
                  <label className="block text-xs font-medium text-text-strong mb-1.5">
                    Amount (BDT) *
                  </label>
                  <input
                    type="number"
                    value={row.amount}
                    onChange={(e) =>
                      handleRowChange(row.id, "amount", e.target.value)
                    }
                    className="w-full border border-input rounded-xl px-3 py-2 bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-10.5 text-sm font-mono placeholder:text-text-muted"
                    placeholder="0.00"
                  />
                </div>

                {/* Description */}
                <div className="sm:col-span-1 md:col-span-3">
                  <label className="block text-xs font-medium text-text-strong mb-1.5">
                    Description (Max 100)
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    value={row.description}
                    onChange={(e) =>
                      handleRowChange(row.id, "description", e.target.value)
                    }
                    className="w-full border border-input rounded-xl px-3 py-2 bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-10.5 text-sm placeholder:text-text-muted"
                    placeholder="Transfer reason..."
                  />
                </div>

                {/* Transfer Date */}
                <div className="sm:col-span-1 md:col-span-2">
                  <label className="block text-xs font-medium text-text-strong mb-1.5">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={row.transferDate}
                    onChange={(e) =>
                      handleRowChange(row.id, "transferDate", e.target.value)
                    }
                    className="w-full border border-input rounded-xl px-3 py-2 bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-10.5 text-sm"
                  />
                </div>

                {/* Desktop Remove Action */}
                <div className="hidden md:flex md:col-span-1 items-end self-end h-10.5 mb-0.5 justify-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRow(row.id)}
                    disabled={rows.length === 1}
                    className="size-9 text-text-muted hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Remove Row"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="mt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 border-t border-border pt-5">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="outline"
              onClick={addRow}
              className="gap-2 cursor-pointer"
            >
              <Plus className="size-4" />
              Add Another Transfer
            </Button>

            <Button
              variant="ghost"
              onClick={handleReset}
              className="gap-1.5 text-text-muted hover:text-destructive cursor-pointer"
              title="Reset form and clear all entries"
            >
              <RotateCcw className="size-4" />
              Reset
            </Button>
          </div>

          <Button
            onClick={handleGenerateExcel}
            className="gap-2 cursor-pointer"
          >
            <FileSpreadsheet className="size-4" />
            Generate Excel
          </Button>
        </div>
      </div>

      {/* Salary Sheet Generator Modal */}
      {showSalaryModal && (
        <Modal
          isOpen={showSalaryModal}
          onClose={() => setShowSalaryModal(false)}
          title="Create Salary Sheet"
          subtitle="Generate Standard Chartered Bank bulk transfer Excel for employees and additional payouts."
          icon={<Briefcase className="size-5 text-primary" />}
          maxWidth="4xl"
        >
          <div className="p-4 sm:p-6 overflow-y-auto max-h-[75vh] w-full flex-1 flex flex-col gap-6">
            {/* Settings Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 p-4 bg-muted/40 rounded-2xl border border-border text-xs sm:text-sm">
              <div className="flex flex-col gap-1.5">
                <label className="font-normal text-text-strong">
                  Salary Month / Reason *
                </label>
                <input
                  type="text"
                  value={salaryReason}
                  onChange={(e) => setSalaryReason(e.target.value)}
                  className="w-full border border-input bg-background rounded-xl px-3 py-2 text-sm text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 placeholder:text-text-muted"
                  placeholder="e.g. Salary for September 2026"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-normal text-text-strong">
                  Transfer Date *
                </label>
                <input
                  type="date"
                  value={salaryDate}
                  onChange={(e) => setSalaryDate(e.target.value)}
                  className="w-full border border-input bg-background rounded-xl px-3 py-2 text-sm text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-normal text-text-strong">
                  Debit Account *
                </label>
                <select
                  value={salaryDebitAccount}
                  onChange={(e) => setSalaryDebitAccount(e.target.value)}
                  className="w-full border border-input bg-background rounded-xl px-3.5 py-2.5 pr-10 text-sm text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 font-mono cursor-pointer min-h-11"
                >
                  {debitAccounts.map((acc) => (
                    <option key={acc.id} value={acc.account_number}>
                      {acc.account_number} ({acc.account_label || "SCB"})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Section 1: Marked Employees Table */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between pb-1">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs sm:text-sm font-normal text-text-strong">
                  <input
                    type="checkbox"
                    checked={
                      employeeSalaryRows.length > 0 &&
                      employeeSalaryRows.every((r) => r.selected)
                    }
                    onChange={(e) => handleToggleAllEmployees(e.target.checked)}
                    className="size-4 rounded border-input text-primary focus:ring-ring/20"
                  />
                  <span>Marked Employees ({employeeSalaryRows.length})</span>
                </label>
                <span className="text-xs text-text-muted">
                  {selectedSalaryRows.length} of {employeeSalaryRows.length}{" "}
                  selected
                  {selectedSalaryRows.length > 0 &&
                    ` (৳${employeeSubtotal.toLocaleString()})`}
                </span>
              </div>

              {employeeSalaryRows.length === 0 ? (
                <div className="p-5 text-center bg-muted/30 rounded-xl border border-border text-text-muted text-xs sm:text-sm flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <UserCheck className="size-5 text-text-muted shrink-0" />
                    <span>
                      No employees currently marked. You can mark them in
                      Receiver Bank Accounts or add transfers below.
                    </span>
                  </div>
                  <Link
                    href="/vendors"
                    className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-normal whitespace-nowrap transition-colors hover:opacity-90"
                  >
                    <span>Mark Employees</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              ) : (
                <div className="border border-border rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-xs sm:text-sm text-left">
                    <thead className="bg-muted/60 text-text-muted border-b border-border font-medium">
                      <tr>
                        <th className="px-3 sm:px-4 py-2.5 w-10 text-center"></th>
                        <th className="px-3 sm:px-4 py-2.5">Employee</th>
                        <th className="px-3 sm:px-4 py-2.5">Bank / Branch</th>
                        <th className="px-3 sm:px-4 py-2.5">
                          Account & Routing
                        </th>
                        <th className="px-3 sm:px-4 py-2.5 text-right w-44">
                          Salary Amount (BDT)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {employeeSalaryRows.map((row) => (
                        <tr
                          key={row.vendorId}
                          className={`hover:bg-muted/40 transition-colors ${
                            row.selected ? "bg-primary/5" : "opacity-60"
                          }`}
                        >
                          <td className="px-3 sm:px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={row.selected}
                              onChange={() =>
                                handleToggleEmployeeRow(row.vendorId)
                              }
                              className="size-4 rounded border-input text-primary focus:ring-ring/20 cursor-pointer"
                            />
                          </td>
                          <td className="px-3 sm:px-4 py-3 font-medium text-text-strong">
                            {row.vendor.receiver_name}
                          </td>
                          <td className="px-3 sm:px-4 py-3 text-text-default">
                            <div>{row.vendor.bank_name}</div>
                            {row.vendor.branch_name && (
                              <div className="text-xs text-text-muted">
                                {row.vendor.branch_name}
                              </div>
                            )}
                          </td>
                          <td className="px-3 sm:px-4 py-3 font-mono text-xs text-text-muted">
                            <div>A/C: {row.vendor.account_number}</div>
                            <div>
                              Routing: {row.vendor.routing_number || "—"}
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 py-3 text-right">
                            <input
                              type="number"
                              disabled={!row.selected}
                              value={row.amount}
                              onChange={(e) =>
                                handleSalaryAmountChange(
                                  row.vendorId,
                                  e.target.value,
                                )
                              }
                              placeholder="0.00"
                              className="w-36 text-right border border-input bg-background text-text-strong rounded-xl px-3 py-1.5 text-sm font-mono focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:bg-muted disabled:opacity-50"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Section 2: Additional Transactions */}
            <div className="pt-4 border-t border-border flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-normal text-text-strong flex items-center gap-2">
                    <Layers className="size-4 text-primary" />
                    <span>Additional Transactions</span>
                    {additionalSalaryRows.length > 0 && (
                      <span className="text-xs text-text-muted font-mono">
                        ({additionalSalaryRows.length})
                      </span>
                    )}
                  </h4>
                  <p className="text-xs text-text-muted mt-0.5">
                    Include extra payouts (bonuses, vendor invoices, allowances)
                    in this same Excel sheet.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddAdditionalSalaryRow}
                  className="gap-1.5 cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="size-3.5" />
                  <span>Add Additional Transaction</span>
                </Button>
              </div>

              {/* Additional Transactions Table */}
              {additionalSalaryRows.length > 0 && (
                <div className="border border-border rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-xs sm:text-sm text-left">
                    <thead className="bg-muted/60 text-text-muted border-b border-border font-medium">
                      <tr>
                        <th className="px-3 sm:px-4 py-2.5 w-5/12">
                          Receiver *
                        </th>
                        <th className="px-3 sm:px-4 py-2.5">
                          Reason / Description
                        </th>
                        <th className="px-3 sm:px-4 py-2.5 text-right w-44">
                          Amount (BDT) *
                        </th>
                        <th className="px-2 py-2.5 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-card">
                      {additionalSalaryRows.map((add) => {
                        const matchedVendor = vendors.find(
                          (v) => v.id === add.vendorId,
                        );
                        return (
                          <tr key={add.id} className="hover:bg-muted/30">
                            <td className="px-3 sm:px-4 py-3">
                              <select
                                required
                                value={add.vendorId || ""}
                                onChange={(e) =>
                                  handleAdditionalSalaryRowChange(
                                    add.id,
                                    "vendorId",
                                    e.target.value || null,
                                  )
                                }
                                className="w-full border border-input rounded-xl px-3 py-1.5 pr-8 text-xs sm:text-sm bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 cursor-pointer"
                              >
                                <option value="">-- Choose Receiver --</option>
                                {vendors.map((v) => (
                                  <option key={v.id} value={v.id}>
                                    {v.receiver_name} ({v.bank_name || "Bank"} -{" "}
                                    {v.account_number})
                                  </option>
                                ))}
                              </select>
                              {matchedVendor && (
                                <div className="text-xs text-text-muted font-mono mt-1">
                                  A/C: {matchedVendor.account_number} • Routing:{" "}
                                  {matchedVendor.routing_number || "—"}
                                </div>
                              )}
                            </td>
                            <td className="px-3 sm:px-4 py-3">
                              <input
                                type="text"
                                value={add.description}
                                onChange={(e) =>
                                  handleAdditionalSalaryRowChange(
                                    add.id,
                                    "description",
                                    e.target.value,
                                  )
                                }
                                placeholder={
                                  salaryReason ||
                                  "e.g. Festival Bonus, Office Allowance"
                                }
                                className="w-full border border-input rounded-xl px-3 py-1.5 pr-8 text-xs sm:text-sm bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 cursor-pointer"
                              />
                            </td>
                            <td className="px-3 sm:px-4 py-3 text-right">
                              <input
                                type="number"
                                value={add.amount}
                                onChange={(e) =>
                                  handleAdditionalSalaryRowChange(
                                    add.id,
                                    "amount",
                                    e.target.value,
                                  )
                                }
                                placeholder="0.00"
                                className="w-36 text-right border border-input rounded-xl px-3 py-1.5 text-sm font-mono bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20"
                              />
                            </td>
                            <td className="px-2 py-3 text-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  handleRemoveAdditionalSalaryRow(add.id)
                                }
                                className="size-8 text-text-muted hover:text-destructive hover:bg-destructive/10"
                                title="Remove additional transaction"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer / Summary & Actions */}
          <div className="p-4 sm:p-5 bg-muted/40 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
            <div className="text-left w-full sm:w-auto">
              <span className="text-xs text-text-muted block">
                Total Payout ({selectedSalaryRows.length} Employees
                {additionalSalaryRows.length > 0
                  ? ` + ${additionalSalaryRows.length} Additional`
                  : ""}
                )
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-lg sm:text-xl font-normal font-mono text-text-strong">
                  ৳{" "}
                  {grandTotalPayout.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                {additionalSalaryRows.length > 0 && (
                  <span className="text-xs text-text-muted">
                    (Emp: ৳{employeeSubtotal.toLocaleString()} • Add: ৳
                    {additionalSubtotal.toLocaleString()})
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowSalaryModal(false)}
              >
                Cancel
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleLoadEmployeesIntoTable}
                title="Load all into the main generator table"
              >
                Load into Table
              </Button>

              <Button
                type="button"
                onClick={handleDownloadSalaryExcel}
                className="gap-2 cursor-pointer"
              >
                <Download className="size-4" />
                <span>Download Salary Excel</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDeleteModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={executeReset}
        title="Reset All Entries?"
        description="Are you sure you want to clear all transfer entries? This action cannot be undone."
        itemName="All Transfer Entries"
      />

      {/* SCB Upload Notification Modal */}
      {showScbPopup && (
        <Modal
          isOpen={showScbPopup}
          onClose={() => setShowScbPopup(false)}
          title="Action Required"
        >
          <div className="p-6 text-center flex flex-col items-center gap-4">
            <div className="size-12 bg-primary/10 rounded-full flex items-center justify-center">
              <CheckCircle2 className="size-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-text-strong">
              Excel Generated!
            </h3>
            <p className="text-sm text-text-muted max-w-sm">
              Your bulk transfer Excel file has been downloaded. Please proceed
              to the Standard Chartered Straight2Bank dashboard to upload it.
            </p>
            <div className="pt-2">
              <a
                href="https://s2b.standardchartered.com/unifiedlogin/login/index.html?language=en_AE#/login"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowScbPopup(false)}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-medium rounded-xl hover:opacity-90 transition-opacity w-full sm:w-auto text-sm"
              >
                Go to SCB Dashboard
                <ExternalLink className="size-4" />
              </a>
            </div>
          </div>
        </Modal>
      )}

      {/* Footer Quick Link */}
      <div className="text-center pt-6 pb-2">
        <a
          href="https://s2b.standardchartered.com/unifiedlogin/login/index.html?language=en_AE#/login"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-strong transition-colors hover:underline"
        >
          Open SCB Straight2Bank Portal
          <ExternalLink className="size-3.5" />
        </a>
      </div>
    </div>
  );
}
