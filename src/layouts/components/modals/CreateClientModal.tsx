"use client";

import { createClient } from "@/actions";
import { Button } from "@/components/ui/button";
import type { Client } from "@/types";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Modal } from "./Modal";

interface CreateClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (clientId: string) => void;
  defaultValues: {
    name?: string;
    bank_name?: string;
    bank_address?: string;
  };
}

export function CreateClientModal({
  isOpen,
  onClose,
  onSuccess,
  defaultValues,
}: CreateClientModalProps) {
  const { register, handleSubmit, reset, setValue } =
    useForm<Partial<Client>>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setError("");
      reset();

      if (defaultValues.name) setValue("name", defaultValues.name);
      if (defaultValues.bank_name)
        setValue("bank_name", defaultValues.bank_name);
      if (defaultValues.bank_address)
        setValue("bank_address", defaultValues.bank_address);
    }
  }, [isOpen, defaultValues, setValue, reset]);

  if (!isOpen) return null;

  const onSubmit = async (data: Partial<Client>) => {
    if (!data.name?.trim()) {
      setError("Client name is required.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const newClient = await createClient({
        name: data.name.trim(),
        address: data.address?.trim() || undefined,
        tax_id: data.tax_id?.trim() || undefined,
        bank_name: data.bank_name?.trim() || undefined,
        bank_address: data.bank_address?.trim() || undefined,
      });
      onSuccess(newClient ? (newClient as any).id : "");
    } catch (err: any) {
      setError(err.message || "Failed to create client");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Client"
      subtitle="Please provide client and bank information."
      maxWidth="lg"
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
          <div className="md:col-span-2 flex flex-col gap-1.5">
            <label className="text-sm font-normal text-text-strong">
              Company / Client Name *
            </label>
            <input
              placeholder="e.g. Acme Corp"
              {...register("name", { required: true })}
              className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-10.5"
            />
          </div>

          <div className="md:col-span-2 flex flex-col gap-1.5">
            <label className="text-sm font-normal text-text-strong">
              Company Address
            </label>
            <textarea
              placeholder="Full address..."
              {...register("address")}
              rows={2}
              className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </div>

          <div className="md:col-span-2 flex flex-col gap-1.5">
            <label className="text-sm font-normal text-text-strong">
              Tax ID / VAT No
            </label>
            <input
              placeholder="Optional"
              {...register("tax_id")}
              className="w-full border border-input rounded-xl px-3 py-2 text-sm font-mono bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-10.5"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-normal text-text-strong">
              Bank Name
            </label>
            <input
              placeholder="Bank Name"
              {...register("bank_name")}
              className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-10.5"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-normal text-text-strong">
              Bank Address
            </label>
            <input
              placeholder="Bank Address"
              {...register("bank_address")}
              className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-10.5"
            />
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
            <span>Save &amp; Continue</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
}
