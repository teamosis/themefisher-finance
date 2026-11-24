"use client";

import { updateClient } from "@/actions";
import { Button } from "@/components/ui/button";
import type { Client } from "@/types";
import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { Modal } from "./modal";

interface EditClientModalProps {
  client: Client | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updated: Client) => void;
}

function EditClientForm({
  client,
  onClose,
  onSaved,
}: {
  client: Client;
  onClose: () => void;
  onSaved: (updated: Client) => void;
}) {
  const [name, setName] = useState(client.name || "");
  const [address, setAddress] = useState(client.address || "");
  const [taxId, setTaxId] = useState(client.tax_id || "");
  const [bankName, setBankName] = useState(client.bank_name || "");
  const [bankAddress, setBankAddress] = useState(client.bank_address || "");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("Client name is required.");
      return;
    }

    setSaving(true);
    setErrorMsg("");

    const updatePayload: Record<string, unknown> = {
      name: name.trim(),
      address: address.trim() || undefined,
      tax_id: taxId.trim() || undefined,
      bank_name: bankName.trim() || undefined,
      bank_address: bankAddress.trim() || undefined,
    };

    try {
      const updatedItem = await updateClient(client.id, updatePayload);
      onSaved(updatedItem as unknown as Client);
      onClose();
    } catch (error: any) {
      console.error("Failed to update client:", error.message);
      setErrorMsg("Unable to update client details. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full flex flex-col h-full">
      {errorMsg && (
        <div className="mx-6 mt-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl shrink-0">
          {errorMsg}
        </div>
      )}

      <form
        onSubmit={handleSave}
        className="p-5 sm:p-6 flex flex-col gap-4 overflow-y-auto max-h-[75vh]"
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-normal text-text-strong">
            Client / Company Name *
          </label>
          <input
            type="text"
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acme Corp"
            className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-10.5"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-normal text-text-strong">
            Client Address
          </label>
          <textarea
            rows={2}
            maxLength={300}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Full billing address"
            className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-normal text-text-strong">
            VAT / Tax ID
          </label>
          <input
            type="text"
            maxLength={50}
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
            placeholder="e.g. EU123456789"
            className="w-full border border-input rounded-xl px-3 py-2 text-sm font-mono bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-10.5"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-normal text-text-strong">
              Remitting Bank Name
            </label>
            <input
              type="text"
              maxLength={120}
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="e.g. Barclays Bank PLC"
              className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-10.5"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-normal text-text-strong">
              Remitting Bank Address
            </label>
            <input
              type="text"
              maxLength={250}
              value={bankAddress}
              onChange={(e) => setBankAddress(e.target.value)}
              placeholder="Branch, City & Country"
              className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-10.5"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
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

export function EditClientModal({
  client,
  isOpen,
  onClose,
  onSaved,
}: EditClientModalProps) {
  if (!isOpen || !client) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Client"
      subtitle="Modify client billing and remitting bank details."
      maxWidth="lg"
    >
      <EditClientForm client={client} onClose={onClose} onSaved={onSaved} />
    </Modal>
  );
}
