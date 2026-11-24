"use client";

import {
  createClient as createClientAction,
  deleteClient as deleteClientAction,
  getClients,
} from "@/actions";
import { ConfirmDeleteModal } from "@/components/modals/ConfirmDeleteModal";
import { EditClientModal } from "@/components/modals/EditClientModal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Client, ClientFormData } from "@/types";
import {
  Building2,
  Edit2,
  FileText,
  Landmark,
  MapPin,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

export default function ClientsClient({
  initialClients,
}: {
  initialClients: Client[];
}) {
  const [clients, setClients] = useState<Client[]>(initialClients);
  const { register, handleSubmit, reset } = useForm<ClientFormData>();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Edit modal state
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const fetchClients = useCallback(async () => {
    try {
      const data = await getClients();
      setClients(data);
    } catch (error: any) {
      console.error("Error fetching clients:", error.message);
    }
    setLoading(false);
  }, []);

  const onSubmit = async (data: ClientFormData) => {
    const cleanName = data.name?.trim();
    if (!cleanName) {
      alert("Client name is required.");
      return;
    }

    setSubmitting(true);
    const payload: Record<string, unknown> = {
      name: cleanName,
      address: data.address?.trim() || null,
      tax_id: data.tax_id?.trim() || null,
      bank_name: data.bank_name?.trim() || null,
      bank_address: data.bank_address?.trim() || null,
    };

    try {
      await createClientAction(payload);
      reset();
      await fetchClients();
    } catch (error: any) {
      console.error("Error creating client:", error.message);
      alert("Unable to create client. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setIsEditModalOpen(true);
  };

  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleClientSaved = (updated: Client) => {
    setClients((prev) =>
      prev
        .map((c) => (c.id === updated.id ? updated : c))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
  };

  const handleConfirmDelete = async () => {
    if (!deletingClient) return;
    setIsDeleting(true);
    try {
      await deleteClientAction(deletingClient.id);
      setClients((prev) => prev.filter((c) => c.id !== deletingClient.id));
      setDeletingClient(null);
    } catch (error: any) {
      console.error("Error deleting client:", error.message);
      alert("Unable to delete client. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredClients = useMemo(() => {
    if (!searchTerm.trim()) return clients;
    const q = searchTerm.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.address && c.address.toLowerCase().includes(q)) ||
        (c.tax_id && c.tax_id.toLowerCase().includes(q)) ||
        (c.bank_name && c.bank_name.toLowerCase().includes(q)),
    );
  }, [clients, searchTerm]);

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-8 pb-16">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-strong">
          Clients
        </h1>
        <p className="text-sm text-text-muted mt-1">
          Manage clients, remitting banks, and addresses for your invoices and
          Form-C declarations.
        </p>
      </div>

      {/* Add Client Card */}
      <div className="bg-card p-5 sm:p-6 rounded-2xl shadow-xs border border-border flex flex-col gap-4">
        <h2 className="text-base font-bold text-text-strong">Add New Client</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm font-semibold text-text-strong flex items-center gap-1.5">
                <Building2 className="size-3.5 text-text-muted" />
                Client Name *
              </label>
              <input
                {...register("name", { required: true })}
                maxLength={120}
                className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-10.5 placeholder:text-text-muted"
                placeholder="Client or company name"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm font-semibold text-text-strong flex items-center gap-1.5">
                <MapPin className="size-3.5 text-text-muted" />
                Client Address
              </label>
              <input
                {...register("address")}
                maxLength={300}
                className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-10.5 placeholder:text-text-muted"
                placeholder="Full billing address"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm font-semibold text-text-strong flex items-center gap-1.5">
                <FileText className="size-3.5 text-text-muted" />
                VAT / Tax ID
              </label>
              <input
                {...register("tax_id")}
                maxLength={50}
                className="w-full border border-input rounded-xl px-3 py-2 text-sm font-mono bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-10.5 placeholder:text-text-muted"
                placeholder="e.g. EU123456789"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm font-semibold text-text-strong flex items-center gap-1.5">
                <Landmark className="size-3.5 text-text-muted" />
                Remitting Bank Name
              </label>
              <input
                {...register("bank_name")}
                maxLength={120}
                className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-10.5 placeholder:text-text-muted"
                placeholder="e.g. Barclays Bank PLC"
              />
            </div>

            <div className="md:col-span-2 flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm font-semibold text-text-strong flex items-center gap-1.5">
                <MapPin className="size-3.5 text-text-muted" />
                Remitting Bank Address
              </label>
              <input
                {...register("bank_address")}
                maxLength={250}
                className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-10.5 placeholder:text-text-muted"
                placeholder="Branch, City & Country"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={submitting}
              className="gap-2 cursor-pointer"
            >
              <Plus className="size-4" />
              <span>{submitting ? "Adding..." : "Add Client"}</span>
            </Button>
          </div>
        </form>
      </div>

      {/* Existing Clients List */}
      <div className="bg-card rounded-2xl shadow-xs border border-border overflow-hidden flex flex-col">
        <div className="p-4 sm:p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/20">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-text-strong">
              Client Directory
            </h2>
            <span className="text-xs text-text-muted">({clients.length})</span>
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
            <Search className="size-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search clients..."
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-input rounded-xl focus:border-ring focus:ring-2 focus:ring-ring/20 bg-background text-text-strong placeholder:text-text-muted"
            />
          </div>
        </div>

        {loading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex flex-col gap-2 flex-1 min-w-0 pr-0 sm:pr-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Skeleton className="h-5 w-40 rounded" />
                    <Skeleton className="h-3.5 w-24 rounded" />
                  </div>
                  <Skeleton className="h-3.5 w-60 rounded" />
                  <Skeleton className="h-3 w-44 rounded" />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Skeleton className="h-8 w-16 rounded-xl" />
                  <Skeleton className="h-8 w-16 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredClients.map((client) => (
              <div
                key={client.id}
                className="p-4 sm:p-5 hover:bg-muted/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex flex-col gap-1 flex-1 min-w-0 pr-0 sm:pr-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm sm:text-base text-text-strong truncate">
                      {client.name}
                    </h3>
                    {client.tax_id && (
                      <span className="text-[11px] font-mono text-text-muted">
                        Tax ID: {client.tax_id}
                      </span>
                    )}
                  </div>

                  {client.address && (
                    <div className="text-xs text-text-muted flex items-start gap-1.5 wrap-break-word">
                      <MapPin className="size-3.5 text-text-muted shrink-0 mt-0.5" />
                      <span className="whitespace-pre-line leading-relaxed">
                        {client.address}
                      </span>
                    </div>
                  )}

                  {(client.bank_name || client.bank_address) && (
                    <div className="text-xs text-text-muted flex items-center gap-1.5 pt-0.5 flex-wrap">
                      <Landmark className="size-3.5 text-text-muted shrink-0" />
                      <span>
                        {client.bank_name && (
                          <strong className="text-text-strong font-medium">
                            {client.bank_name}
                          </strong>
                        )}
                        {client.bank_name && client.bank_address && " — "}
                        {client.bank_address}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions: Edit and Delete */}
                <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditClient(client)}
                    className="gap-1.5 text-xs cursor-pointer"
                  >
                    <Edit2 className="size-3.5" />
                    <span>Edit</span>
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeletingClient(client)}
                    className="gap-1.5 text-xs text-text-muted hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                  >
                    <Trash2 className="size-3.5" />
                    <span>Delete</span>
                  </Button>
                </div>
              </div>
            ))}

            {filteredClients.length === 0 && (
              <div className="p-8 text-center text-text-muted text-sm">
                {searchTerm
                  ? "No clients match your search query."
                  : "No clients found."}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Client Modal */}
      <EditClientModal
        client={editingClient}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSaved={handleClientSaved}
      />
      <ConfirmDeleteModal
        isOpen={!!deletingClient}
        onClose={() => setDeletingClient(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Client?"
        description="Are you sure you want to permanently delete this client? All associated data will be removed."
        itemName={deletingClient?.name}
        isDeleting={isDeleting}
      />
    </div>
  );
}
