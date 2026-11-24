"use client";

import { updateInvoice } from "@/actions";
import SearchableClientSelect from "@/components/forms/searchable-client-select";
import { Button } from "@/components/ui/button";
import type { Client, Invoice, PaymentAccount } from "@/types";
import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { Modal } from "./modal";

interface EditInvoiceModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updated: Invoice) => void;
  clients: Client[];
  accounts: PaymentAccount[];
}

function formatDateForInput(dateStr?: string): string {
  if (!dateStr) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    try {
      return d.toISOString().split("T")[0];
    } catch {}
  }
  return dateStr;
}

function EditInvoiceForm({
  invoice,
  onClose,
  onSaved,
  clients,
  accounts,
}: {
  invoice: Invoice;
  onClose: () => void;
  onSaved: (updated: Invoice) => void;
  clients: Client[];
  accounts: PaymentAccount[];
}) {
  const [clientId, setClientId] = useState(invoice.client_id || "");
  const [invoiceNumber, setInvoiceNumber] = useState(
    invoice.invoice_number || "",
  );
  const [invoiceDate, setInvoiceDate] = useState(
    formatDateForInput(invoice.invoice_date),
  );
  const [currency, setCurrency] = useState(invoice.currency || "USD");
  const [amount, setAmount] = useState(
    invoice.amount !== undefined ? String(invoice.amount) : "",
  );
  const [receivedAmount, setReceivedAmount] = useState(
    invoice.received_amount !== undefined
      ? String(invoice.received_amount)
      : "",
  );
  const [description, setDescription] = useState(invoice.description || "");
  const [paymentMethods, setPaymentMethods] = useState<string[]>(
    invoice.payment_methods || [],
  );
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const toggleAccount = (accId: string) => {
    setPaymentMethods((prev) =>
      prev.includes(accId)
        ? prev.filter((id) => id !== accId)
        : [...prev, accId],
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      setErrorMsg("Please select a client.");
      return;
    }

    const cleanInvoiceNumber = invoiceNumber.trim();
    if (!cleanInvoiceNumber) {
      setErrorMsg("Invoice number is required.");
      return;
    }

    const cleanDescription = description.trim();
    if (!cleanDescription) {
      setErrorMsg("Description is required.");
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg("Please enter a valid invoice amount greater than 0.");
      return;
    }

    const parsedReceived = receivedAmount ? parseFloat(receivedAmount) : 0;
    if (isNaN(parsedReceived) || parsedReceived < 0) {
      setErrorMsg("Received amount cannot be negative.");
      return;
    }

    setSaving(true);
    setErrorMsg("");

    const updatePayload: Record<string, unknown> = {
      client_id: clientId || undefined,
      invoice_number: cleanInvoiceNumber,
      invoice_date: invoiceDate || undefined,
      currency: currency || "USD",
      amount: parsedAmount,
      description: cleanDescription,
      received_amount: parsedReceived,
      payment_methods: paymentMethods,
    };

    try {
      const updatedItem = await updateInvoice(invoice.id, updatePayload);
      onSaved(updatedItem as unknown as Invoice);
      onClose();
    } catch (error: any) {
      console.error("Failed to update invoice:", error.message);
      setErrorMsg("Unable to update invoice. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full flex flex-col h-full">
      {errorMsg && (
        <div className="mx-6 mt-4 p-3 bg-destructive/10 text-destructive text-xs rounded-xl border border-destructive/20">
          {errorMsg}
        </div>
      )}

      <form
        onSubmit={handleSave}
        className="p-5 sm:p-6 flex flex-col gap-4 overflow-y-auto max-h-[75vh]"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative z-20 flex flex-col gap-1.5">
            <label className="text-sm font-normal text-text-strong">
              Client *
            </label>
            <SearchableClientSelect
              clients={clients}
              value={clientId}
              onChange={(val) => setClientId(val)}
              placeholder="Select a client..."
            />
          </div>

          <div className="relative z-10 flex flex-col gap-1.5">
            <label className="text-sm font-normal text-text-strong">
              Invoice Number *
            </label>
            <input
              type="text"
              required
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="w-full border border-input rounded-xl px-3 py-2 text-sm font-mono bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-10.5"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-normal text-text-strong">
              Invoice Date *
            </label>
            <input
              type="date"
              required
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="w-full border border-input rounded-xl px-3.5 py-2.5 pr-10 text-sm bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-11 cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-normal text-text-strong">
              Currency *
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full border border-input rounded-xl px-3.5 py-2.5 pr-10 text-sm bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-11 cursor-pointer"
            >
              <option value="USD">USD</option>
              <option value="BDT">BDT</option>
              <option value="GBP">GBP</option>
              <option value="EUR">EUR</option>
              <option value="CAD">CAD</option>
              <option value="AUD">AUD</option>
              <option value="CHF">CHF</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-normal text-text-strong">
              Amount *
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full border border-input rounded-xl px-3 py-2 text-sm font-mono bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-10.5"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-normal text-text-strong">
              Received Amount
            </label>
            <input
              type="number"
              step="0.01"
              value={receivedAmount}
              onChange={(e) => setReceivedAmount(e.target.value)}
              className="w-full border border-input rounded-xl px-3 py-2 text-sm font-mono bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-10.5"
            />
          </div>

          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <label className="text-sm font-normal text-text-strong">
              Description *
            </label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-input rounded-xl px-3.5 py-2.5 pr-10 text-sm bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-11 cursor-pointer"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <label className="text-sm font-normal text-text-strong">
            Payment Bank Account(s)
          </label>
          <div className="flex flex-col gap-2">
            {accounts.map((a) => {
              const isChecked = paymentMethods.includes(a.id);
              return (
                <label
                  key={a.id}
                  className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                    isChecked
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background hover:bg-muted/30"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleAccount(a.id)}
                    className="size-4 text-primary rounded border-input"
                  />
                  <div className="text-xs sm:text-sm">
                    <span className="font-normal text-text-strong">
                      {a.bank_name || a.account_name}
                    </span>
                    {a.account_number && (
                      <span className="text-text-muted font-mono ml-2">
                        {a.account_number}
                      </span>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="gap-2 cursor-pointer"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            <span>Save Changes</span>
          </Button>
        </div>
      </form>
    </div>
  );
}

export function EditInvoiceModal({
  invoice,
  isOpen,
  onClose,
  onSaved,
  clients,
  accounts,
}: EditInvoiceModalProps) {
  if (!isOpen || !invoice) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Invoice"
      subtitle={invoice.invoice_number}
      maxWidth="2xl"
    >
      <EditInvoiceForm
        invoice={invoice}
        onClose={onClose}
        onSaved={onSaved}
        clients={clients}
        accounts={accounts}
      />
    </Modal>
  );
}
