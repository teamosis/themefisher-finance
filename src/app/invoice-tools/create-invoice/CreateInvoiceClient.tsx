"use client";

import { createInvoice, deleteInvoice as deleteInvoiceAction } from "@/actions";
import SearchableClientSelect from "@/components/forms/SearchableClientSelect";
import { ConfirmDeleteModal } from "@/components/modals/ConfirmDeleteModal";
import { EditInvoiceModal } from "@/components/modals/EditInvoiceModal";
import { Button } from "@/components/ui/button";
import { parseMT103 } from "@/lib/pdfParser";
import type { Client, Invoice, InvoiceFormData, PaymentAccount } from "@/types";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit2,
  ExternalLink,
  Loader2,
  Search,
  Trash2,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";
import Script from "next/script";
import { useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";

export default function CreateInvoiceClient({
  initialClients,
  initialAccounts,
  initialInvoices,
}: {
  initialClients: Client[];
  initialAccounts: PaymentAccount[];
  initialInvoices: Invoice[];
}) {
  const [clients] = useState<Client[]>(initialClients);
  const [accounts] = useState<PaymentAccount[]>(initialAccounts);
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<
    string[]
  >(initialAccounts.length > 0 ? [initialAccounts[0].id] : []);
  const [submitting, setSubmitting] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");

  const initialDateStr = new Date().toISOString().split("T")[0];
  const { register, handleSubmit, reset, setValue } = useForm<InvoiceFormData>({
    defaultValues: {
      description: "Web development services",
      invoice_number: `TF-${initialDateStr}-01`,
      invoice_date: initialDateStr,
      currency: "USD",
      payment_methods:
        initialAccounts.length > 0 ? [initialAccounts[0].id] : [],
    },
  });
  const [alertData, setAlertData] = useState<{
    title: string;
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showAlert = (
    message: string,
    type: "success" | "error" = "error",
    title?: string,
  ) => {
    setAlertData({
      message,
      type,
      title: title || (type === "success" ? "Success" : "Error"),
    });
  };

  // PDF Upload state
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deletingInvoice, setDeletingInvoice] = useState<Invoice | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPdf(true);
    try {
      const pdfjsLib = (window as any).pdfjsLib;
      if (!pdfjsLib) throw new Error("PDF library not loaded yet");

      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          "//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      }

      let finalInvoiceNumber = "";
      try {
        showAlert("Parsing document...", "success");
        const parsedData = await parseMT103(file);

        if (parsedData?.amount) {
          setValue("amount", parsedData.amount as any);
          setValue("received_amount", parsedData.amount as any);
        }
        if (parsedData?.currency) {
          setValue("currency", parsedData.currency);
        }

        if (parsedData?.value_date) {
          try {
            let parsedDate = new Date(parsedData.value_date);
            if (!isNaN(parsedDate.getTime())) {
              parsedDate.setDate(parsedDate.getDate() - 7);
              setValue("invoice_date", parsedDate.toISOString().split("T")[0]);
            }
          } catch {}
        }

        if (parsedData?.invoice_number) {
          finalInvoiceNumber = parsedData.invoice_number;
        }

        if (parsedData?.client_name) {
          const matched = clients.find((c) =>
            parsedData.client_name
              ?.toLowerCase()
              .includes(c.name.toLowerCase()),
          );
          if (matched) {
            setSelectedClientId(matched.id);
            setValue("client_id", matched.id);
          }
        }
      } catch (err: any) {
        console.error("PDF parsing error", err);
      }

      if (finalInvoiceNumber) {
        setValue("invoice_number", finalInvoiceNumber);
      }

      showAlert("Document data populated into form!", "success");
    } catch (err: any) {
      showAlert(err.message || "Failed to process PDF", "error");
    } finally {
      setIsUploadingPdf(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toggleAccount = (id: string) => {
    const next = selectedPaymentMethods.includes(id)
      ? selectedPaymentMethods.filter((item) => item !== id)
      : [...selectedPaymentMethods, id];
    setSelectedPaymentMethods(next);
    setValue("payment_methods", next);
  };

  const onSubmit = async (data: InvoiceFormData) => {
    if (!selectedClientId) {
      showAlert("Please select a client.", "error");
      return;
    }
    if (!data.invoice_number?.trim()) {
      showAlert("Please enter an invoice number.", "error");
      return;
    }
    if (!data.invoice_date) {
      showAlert("Please select an invoice date.", "error");
      return;
    }
    if (!data.amount || Number(data.amount) <= 0) {
      showAlert("Please enter a valid invoice amount.", "error");
      return;
    }
    if (selectedPaymentMethods.length === 0) {
      showAlert("Please select at least one payment bank account.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        client_id: selectedClientId,
        invoice_number: data.invoice_number.trim(),
        invoice_date: data.invoice_date,
        description: data.description?.trim() || "Web development services",
        amount: Number(data.amount),
        received_amount: data.received_amount
          ? Number(data.received_amount)
          : undefined,
        currency: data.currency || "USD",
        payment_methods: selectedPaymentMethods,
      };

      const newInv = await createInvoice(payload);
      if (newInv) {
        setInvoices((prev) => [newInv as unknown as Invoice, ...prev]);
        reset({
          description: "Web development services",
          invoice_number: `TF-${new Date().toISOString().split("T")[0]}-01`,
          invoice_date: new Date().toISOString().split("T")[0],
          currency: "USD",
          amount: "" as any,
          received_amount: "" as any,
          payment_methods: accounts.length > 0 ? [accounts[0].id] : [],
        });
        setSelectedClientId("");
        setSelectedPaymentMethods(accounts.length > 0 ? [accounts[0].id] : []);
        showAlert("Invoice created successfully!", "success");
      }
    } catch (err: any) {
      showAlert(err.message || "Failed to create invoice.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Table filtering and pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [tableClientFilter, setTableClientFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Edit State
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleEditInvoice = (inv: Invoice) => {
    setEditingInvoice(inv);
    setIsEditModalOpen(true);
  };

  const handleInvoiceSaved = (updated: Invoice) => {
    setInvoices((prev) =>
      prev.map((inv) => (inv.id === updated.id ? updated : inv)),
    );
  };

  const handleDeleteInvoice = async (inv: Invoice) => {
    setDeletingInvoice(inv);
  };

  const handleConfirmDelete = async () => {
    if (!deletingInvoice) return;
    setIsDeleting(true);
    try {
      await deleteInvoiceAction(deletingInvoice.id);
      setInvoices((prev) => prev.filter((i) => i.id !== deletingInvoice.id));
      setDeletingInvoice(null);
    } catch (error: any) {
      console.error("Error deleting invoice:", error.message);
      showAlert("Unable to delete invoice. Please try again.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const tableInvoices = useMemo(() => {
    return invoices
      .filter((inv) => {
        if (tableClientFilter && inv.client_id !== tableClientFilter) {
          return false;
        }
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const client = clients.find((c) => c.id === inv.client_id);
          const matchNum = inv.invoice_number?.toLowerCase().includes(term);
          const matchDesc = inv.description?.toLowerCase().includes(term);
          const matchClient = client?.name?.toLowerCase().includes(term);
          const matchDate = inv.invoice_date?.toLowerCase().includes(term);
          return matchNum || matchDesc || matchClient || matchDate;
        }
        return true;
      })
      .sort((a, b) => {
        const dateA = a.invoice_date || "";
        const dateB = b.invoice_date || "";
        return dateB.localeCompare(dateA);
      });
  }, [invoices, tableClientFilter, searchTerm, clients]);

  const totalPages = Math.ceil(tableInvoices.length / pageSize) || 1;
  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return tableInvoices.slice(start, start + pageSize);
  }, [tableInvoices, currentPage, pageSize]);

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-8 pb-16">
      <Script
        src="//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"
        strategy="lazyOnload"
      />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-strong">
            Create Invoice
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Generate a new client billing record and manage existing invoices.
          </p>
        </div>

        <div>
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingPdf}
            className="gap-2 cursor-pointer"
          >
            {isUploadingPdf ? (
              <Loader2 className="size-4 animate-spin text-text-muted" />
            ) : (
              <UploadCloud className="size-4 text-text-muted" />
            )}
            <span>{isUploadingPdf ? "Parsing..." : "Autofill from PDF"}</span>
          </Button>
        </div>
      </div>

      {/* TOP: Invoice Creation Form */}
      <div className="bg-card p-5 sm:p-6 rounded-2xl shadow-xs border border-border flex flex-col gap-6">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            <div className="relative z-20 flex flex-col gap-1.5">
              <label className="text-sm font-normal text-text-strong">
                Client *
              </label>
              <SearchableClientSelect
                clients={clients}
                value={selectedClientId}
                onChange={(val) => {
                  setSelectedClientId(val);
                  setValue("client_id", val);
                }}
                placeholder="Select a client..."
              />
            </div>

            <div className="relative z-10 flex flex-col gap-1.5">
              <label className="text-sm font-normal text-text-strong">
                Invoice Number *
              </label>
              <input
                {...register("invoice_number", { required: true })}
                maxLength={60}
                className="w-full border border-input rounded-xl px-3 py-2 text-sm font-mono bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-10.5"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-normal text-text-strong">
                Invoice Date *
              </label>
              <input
                type="date"
                {...register("invoice_date", { required: true })}
                className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-10.5"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-normal text-text-strong">
                Currency *
              </label>
              <select
                {...register("currency")}
                defaultValue="USD"
                className="w-full border border-input rounded-xl px-3.5 py-2.5 pr-10 text-sm font-medium bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-11 cursor-pointer"
              >
                <option value="USD">USD ($ - US Dollar)</option>
                <option value="BDT">BDT (৳ - Bangladeshi Taka)</option>
                <option value="GBP">GBP (£ - British Pound)</option>
                <option value="EUR">EUR (€ - Euro)</option>
                <option value="CAD">CAD ($ - Canadian Dollar)</option>
                <option value="AUD">AUD ($ - Australian Dollar)</option>
                <option value="CHF">CHF (CHF - Swiss Franc)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-normal text-text-strong">
                Invoice Amount *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="999999999"
                {...register("amount", { required: true })}
                className="w-full border border-input rounded-xl px-3 py-2 text-sm font-mono bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-10.5 placeholder:text-text-muted"
                placeholder="0.00"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-normal text-text-strong">
                Remitted / Received Amount
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="999999999"
                {...register("received_amount")}
                className="w-full border border-input rounded-xl px-3 py-2 text-sm font-mono bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-10.5 placeholder:text-text-muted"
                placeholder="Optional received amount"
              />
            </div>

            <div className="col-span-1 md:col-span-2 flex flex-col gap-1.5">
              <label className="text-sm font-normal text-text-strong">
                Description (Service Details) *
              </label>
              <input
                {...register("description", { required: true })}
                maxLength={300}
                className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-10.5 placeholder:text-text-muted"
                placeholder="Web development services"
              />
            </div>

            {/* Payment Bank Account Selector */}
            <div className="col-span-1 md:col-span-2 flex flex-col gap-2">
              <label className="text-sm font-normal text-text-strong">
                Payment Bank Account(s) *
              </label>
              <div className="flex flex-col gap-2.5">
                {accounts.map((a) => {
                  const isChecked = selectedPaymentMethods.includes(a.id);
                  return (
                    <div
                      key={a.id}
                      onClick={() => toggleAccount(a.id)}
                      className={`flex items-start gap-3 p-3.5 border rounded-xl cursor-pointer transition-colors select-none ${
                        isChecked
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/30 bg-background"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleAccount(a.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="size-4 mt-0.5 rounded border-input text-primary focus:ring-ring/20 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-normal text-text-strong">
                            {a.bank_name || a.account_name}
                          </span>
                          {a.bic_swift && (
                            <span className="text-xs font-mono text-text-muted">
                              SWIFT: {a.bic_swift}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-text-muted mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                          {a.account_number && (
                            <span>
                              A/C:{" "}
                              <span className="font-mono text-text-strong">
                                {a.account_number}
                              </span>
                            </span>
                          )}
                          {a.name_on_account && (
                            <span>Name: {a.name_on_account}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {accounts.length === 0 && (
                  <div className="p-4 border border-dashed border-border rounded-xl text-center text-sm text-text-muted">
                    No payment accounts configured. Add one in Configuration.
                  </div>
                )}
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full cursor-pointer h-11 text-sm font-normal"
          >
            {submitting ? "Generating Invoice..." : "Generate Invoice"}
          </Button>
        </form>
      </div>

      {/* BOTTOM: List of Invoices with Edit and Delete */}
      <div className="bg-card rounded-2xl shadow-xs border border-border overflow-hidden flex flex-col">
        <div className="p-4 sm:p-5 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-3 bg-muted/20">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-text-strong">
              Invoices
            </h2>
            <span className="text-xs text-text-muted">
              ({tableInvoices.length})
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-60 min-w-0">
              <Search className="size-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search invoice, client..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-input rounded-xl focus:border-ring focus:ring-2 focus:ring-ring/20 bg-background text-text-strong placeholder:text-text-muted"
              />
            </div>

            {/* Client Filter */}
            <select
              value={tableClientFilter}
              onChange={(e) => {
                setTableClientFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="py-2 px-3.5 pr-10 text-xs sm:text-sm border border-input rounded-xl focus:border-ring focus:ring-2 focus:ring-ring/20 bg-background text-text-strong cursor-pointer"
            >
              <option value="">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-text-muted text-xs uppercase font-medium border-b border-border">
              <tr>
                <th className="py-2.5 px-4">Invoice #</th>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Client</th>
                <th className="py-2.5 px-4">Service Details</th>
                <th className="py-2.5 px-4 text-right">Amount</th>
                <th className="py-2.5 px-4 text-right">Remitted</th>
                <th className="py-2.5 px-4 text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedInvoices.map((inv) => {
                const client = clients.find((c) => c.id === inv.client_id);

                return (
                  <tr
                    key={inv.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <span className="font-mono font-normal text-text-strong text-xs sm:text-sm">
                        {inv.invoice_number}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-text-muted whitespace-nowrap text-xs">
                      {inv.invoice_date}
                    </td>
                    <td className="py-3 px-4 font-normal text-text-strong max-w-45 truncate text-xs sm:text-sm">
                      {client?.name || "—"}
                    </td>
                    <td className="py-3 px-4 text-text-muted max-w-50 truncate text-xs">
                      {inv.description}
                    </td>
                    <td className="py-3 px-4 text-right font-normal text-text-strong whitespace-nowrap text-xs sm:text-sm font-mono">
                      {inv.currency || "USD"} {Number(inv.amount).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right text-text-muted whitespace-nowrap text-xs sm:text-sm font-mono">
                      {inv.received_amount
                        ? `${inv.currency || "USD"} ${Number(inv.received_amount).toFixed(2)}`
                        : "—"}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <Link
                          href={`/invoice-tools?invoiceId=${inv.id}`}
                          title="Generate Documents"
                          className="p-1.5 rounded-lg text-text-muted hover:text-text-strong hover:bg-muted transition-colors"
                        >
                          <ExternalLink className="size-4" />
                        </Link>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditInvoice(inv)}
                          title="Edit Invoice"
                          className="size-8 text-text-muted hover:text-text-strong"
                        >
                          <Edit2 className="size-3.5" />
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteInvoice(inv)}
                          title="Delete Invoice"
                          className="size-8 text-text-muted hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginatedInvoices.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-8 text-center text-text-muted text-sm"
                  >
                    No invoices match your search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-3.5 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-muted bg-muted/20">
            <div>
              Showing{" "}
              <span className="font-normal text-text-strong">
                {(currentPage - 1) * pageSize + 1}
              </span>{" "}
              to{" "}
              <span className="font-normal text-text-strong">
                {Math.min(currentPage * pageSize, tableInvoices.length)}
              </span>{" "}
              of{" "}
              <span className="font-normal text-text-strong">
                {tableInvoices.length}
              </span>{" "}
              invoices
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="size-8"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-text-strong px-2">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  setCurrentPage((p) => Math.min(p + 1, totalPages))
                }
                disabled={currentPage === totalPages}
                className="size-8"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Invoice Modal */}
      <EditInvoiceModal
        invoice={editingInvoice}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSaved={handleInvoiceSaved}
        clients={clients}
        accounts={accounts}
      />

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={!!deletingInvoice}
        onClose={() => setDeletingInvoice(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Invoice?"
        description="Are you sure you want to permanently delete this invoice? This action cannot be undone."
        itemName={deletingInvoice?.invoice_number}
        isDeleting={isDeleting}
      />

      {alertData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-card rounded-2xl shadow-xl border border-border max-w-sm w-full p-6 animate-in zoom-in-95 duration-200 flex flex-col items-center text-center gap-4">
            <div
              className={`p-3 rounded-full ${
                alertData.type === "success"
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {alertData.type === "success" ? (
                <CheckCircle2 className="size-7" />
              ) : (
                <AlertCircle className="size-7" />
              )}
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-base font-bold text-text-strong">
                {alertData.title}
              </h3>
              <p className="text-text-muted text-xs leading-relaxed">
                {alertData.message}
              </p>
            </div>
            <Button onClick={() => setAlertData(null)} className="w-full mt-2">
              Continue
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
