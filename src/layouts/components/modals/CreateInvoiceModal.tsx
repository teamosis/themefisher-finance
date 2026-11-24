"use client";

import { createInvoice } from "@/actions";
import { Button } from "@/components/ui/button";
import type { Client, InvoiceFormData, PaymentAccount } from "@/types";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Modal } from "./Modal";

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (invoiceId: string) => void;
  clients: Client[];
  accounts: PaymentAccount[];
  extractedData: any;
}

export function CreateInvoiceModal({
  isOpen,
  onClose,
  onSuccess,
  clients,
  accounts,
  extractedData,
}: CreateInvoiceModalProps) {
  const { register, handleSubmit, reset, setValue } =
    useForm<InvoiceFormData>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<
    string[]
  >([]);

  useEffect(() => {
    if (isOpen) {
      setError("");
      reset();

      if (extractedData?.invoice_number)
        setValue("invoice_number", extractedData.invoice_number);
      if (extractedData?.invoice_date)
        setValue("invoice_date", extractedData.invoice_date);
      if (extractedData?.amount) setValue("amount", extractedData.amount);
      if (extractedData?.amount)
        setValue("received_amount", extractedData.amount);
      if (extractedData?.currency) setValue("currency", extractedData.currency);
      if (extractedData?.client_id)
        setValue("client_id", extractedData.client_id);

      setValue("description", "Web development services");

      if (accounts.length > 0) {
        setSelectedPaymentMethods([accounts[0].id]);
        setValue("payment_methods", [accounts[0].id]);
      } else {
        setSelectedPaymentMethods([]);
      }
    }
  }, [isOpen, extractedData, setValue, reset, accounts]);

  if (!isOpen) return null;

  const toggleAccount = (id: string) => {
    const next = selectedPaymentMethods.includes(id)
      ? selectedPaymentMethods.filter((item) => item !== id)
      : [...selectedPaymentMethods, id];
    setSelectedPaymentMethods(next);
    setValue("payment_methods", next);
  };

  const onSubmit = async (data: InvoiceFormData) => {
    if (!data.client_id) {
      setError("Please select a client.");
      return;
    }

    const cleanInvoiceNumber = data.invoice_number?.trim();
    if (!cleanInvoiceNumber) {
      setError("Invoice number is required.");
      return;
    }

    const parsedAmount =
      typeof data.amount === "string"
        ? parseFloat(data.amount)
        : Number(data.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Valid invoice amount required.");
      return;
    }

    let parsedReceived = parsedAmount;
    if (data.received_amount !== undefined && data.received_amount !== "") {
      const customReceived =
        typeof data.received_amount === "string"
          ? parseFloat(data.received_amount)
          : Number(data.received_amount);
      if (!isNaN(customReceived) && customReceived > 0) {
        parsedReceived = customReceived;
      }
    }

    setSubmitting(true);
    setError("");

    const payload: Record<string, unknown> = {
      client_id: data.client_id,
      invoice_number: cleanInvoiceNumber,
      invoice_date: data.invoice_date,
      currency: data.currency || "USD",
      amount: parsedAmount,
      description: data.description?.trim(),
      received_amount: parsedReceived,
      payment_methods: selectedPaymentMethods,
    };

    try {
      const created = await createInvoice(payload);
      onSuccess((created as any).id);
    } catch (err: any) {
      setError(err.message || "Failed to create invoice");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Invoice"
      subtitle="Complete invoice details to proceed."
      maxWidth="2xl"
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="p-5 sm:p-6 flex flex-col gap-4 overflow-y-auto max-h-[75vh] w-full"
      >
        {error && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-xl flex items-center gap-2 text-xs border border-destructive/20">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-normal text-text-strong">
              Client *
            </label>
            <select
              {...register("client_id", { required: true })}
              className="w-full border border-input rounded-xl px-3.5 py-2.5 pr-10 text-sm bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-11 cursor-pointer"
            >
              <option value="">-- Select a Client --</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-normal text-text-strong">
              Invoice Number *
            </label>
            <input
              {...register("invoice_number", { required: true })}
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
              {...register("amount", { required: true })}
              className="w-full border border-input rounded-xl px-3 py-2 text-sm font-mono bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-10.5"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-normal text-text-strong">
              Description
            </label>
            <input
              {...register("description", { required: true })}
              className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-10.5"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <label className="text-sm font-normal text-text-strong">
            Payment Bank Account(s)
          </label>
          <div className="flex flex-col gap-2">
            {accounts.map((a) => {
              const isChecked = selectedPaymentMethods.includes(a.id);
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
            disabled={submitting}
            className="gap-2 cursor-pointer"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            <span>Create Invoice</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
}
