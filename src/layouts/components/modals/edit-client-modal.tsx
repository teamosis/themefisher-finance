"use client";

import { updateClient } from "@/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Client } from "@/types";
import { Check } from "lucide-react";
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
          <Label className="text-sm font-normal text-text-strong">
            Client / Company Name *
          </Label>
          <Input
            type="text"
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acme Corp"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-sm font-normal text-text-strong">
            Client Address
          </Label>
          <Textarea
            rows={2}
            maxLength={300}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Full billing address"
            className="min-h-0"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-sm font-normal text-text-strong">
            VAT / Tax ID
          </Label>
          <Input
            type="text"
            maxLength={50}
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
            placeholder="e.g. EU123456789"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-normal text-text-strong">
              Remitting Bank Name
            </Label>
            <Input
              type="text"
              maxLength={120}
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="e.g. Barclays Bank PLC"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-normal text-text-strong">
              Remitting Bank Address
            </Label>
            <Input
              type="text"
              maxLength={250}
              value={bankAddress}
              onChange={(e) => setBankAddress(e.target.value)}
              placeholder="Branch, City & Country"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {!saving && <Check />}
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
