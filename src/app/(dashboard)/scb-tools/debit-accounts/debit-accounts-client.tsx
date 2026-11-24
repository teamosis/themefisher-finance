"use client";

import {
  createDebitAccount,
  deleteDebitAccount as deleteDebitAccountAction,
  getDebitAccounts,
  setDefaultDebitAccount as setDefaultDebitAccountAction,
  updateDebitAccount,
} from "@/actions";
import { ConfirmDeleteModal } from "@/components/modals/confirm-delete-modal";
import { Modal } from "@/components/modals/modal";
import { TableRowsSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import type { DebitAccount } from "@/types";
import {
  AlertCircle,
  Check,
  CreditCard,
  Loader2,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";

export default function DebitAccountsClient({
  initialAccounts,
}: {
  initialAccounts: DebitAccount[];
}) {
  const [accounts, setAccounts] = useState<DebitAccount[]>(initialAccounts);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Add Form state
  const [formData, setFormData] = useState({
    account_number: "",
    account_label: "Main SCB Account",
    bank_name: "Standard Chartered Bank",
    is_default: true,
  });

  // Edit State
  const [editingAccount, setEditingAccount] = useState<DebitAccount | null>(
    null,
  );
  const [editFormData, setEditFormData] = useState({
    account_number: "",
    account_label: "",
    bank_name: "",
    is_default: false,
  });
  const [editSaving, setEditSaving] = useState(false);

  // Delete State
  const [deletingAccount, setDeletingAccount] = useState<DebitAccount | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchAccounts = async () => {
    try {
      const data = await getDebitAccounts();
      setAccounts(data || []);
    } catch (err: any) {
      console.error("Error fetching debit accounts:", err);
      setErrorMessage(err.message || "Failed to load debit accounts");
    }
    setLoading(false);
  };

  const triggerSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => {
      setSuccessMessage((current) => (current === msg ? null : current));
    }, 4000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMessage(null);

    try {
      const created = await createDebitAccount({
        account_number: formData.account_number.trim(),
        account_label: formData.account_label.trim() || "Debit Account",
        bank_name: formData.bank_name.trim() || "Standard Chartered Bank",
      });

      if (formData.is_default || accounts.length === 0) {
        await setDefaultDebitAccountAction(created.id);
      }
      setFormData({
        account_number: "",
        account_label: "Main SCB Account",
        bank_name: "Standard Chartered Bank",
        is_default: accounts.length === 0,
      });
      triggerSuccess("Debit account saved successfully to database!");
      fetchAccounts();
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message);
      alert(`Failed to save: ${error.message}`);
    }
    setSaving(false);
  };

  const handleSetDefault = async (acc: DebitAccount) => {
    try {
      await setDefaultDebitAccountAction(acc.id);
      triggerSuccess(
        `Set "${acc.account_label}" as the default debit account!`,
      );
      fetchAccounts();
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Failed to set default";
      alert(msg);
    }
  };

  const handleOpenEdit = (acc: DebitAccount) => {
    setEditingAccount(acc);
    setEditFormData({
      account_number: acc.account_number,
      account_label: acc.account_label,
      bank_name: acc.bank_name,
      is_default: acc.is_default,
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    setEditSaving(true);

    try {
      await updateDebitAccount(editingAccount.id, {
        account_number: editFormData.account_number.trim(),
        account_label: editFormData.account_label.trim(),
        bank_name: editFormData.bank_name.trim(),
      });

      if (editFormData.is_default) {
        await setDefaultDebitAccountAction(editingAccount.id);
      }
      triggerSuccess("Debit account updated successfully!");
      setEditingAccount(null);
      fetchAccounts();
    } catch (error: any) {
      alert(`Update failed: ${error.message}`);
    }
    setEditSaving(false);
  };

  const handleConfirmDelete = async () => {
    if (!deletingAccount) return;
    setIsDeleting(true);

    try {
      await deleteDebitAccountAction(deletingAccount.id);
      triggerSuccess("Debit account removed.");
      setDeletingAccount(null);
      fetchAccounts();
    } catch (error: any) {
      alert(`Delete failed: ${error.message}`);
    }
    setIsDeleting(false);
  };

  const filteredAccounts = accounts.filter(
    (a) =>
      a.account_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.account_label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.bank_name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6 pb-16">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-strong">
          Debit Accounts
        </h1>
        <p className="text-sm text-text-muted mt-1">
          Manage your funding bank debit accounts. The default account is
          automatically loaded into the transfer generator.
        </p>
      </div>

      {/* Error Notification Banner */}
      {errorMessage && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl flex items-center justify-between gap-2 text-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-destructive hover:opacity-75 p-1"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="bg-success/10 border border-success/20 text-success px-4 py-3 rounded-xl flex items-center justify-between gap-2 text-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <Check className="size-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-success hover:opacity-75 p-1"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Add New Debit Account Form */}
      <div className="bg-card rounded-2xl shadow-xs border border-border p-4 sm:p-6 flex flex-col gap-4">
        <h2 className="text-base font-bold text-text-strong">
          Add Debit Account
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 sm:gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-normal text-text-strong">
                Debit Account Number *
              </label>
              <input
                type="text"
                required
                value={formData.account_number}
                onChange={(e) =>
                  setFormData({ ...formData, account_number: e.target.value })
                }
                placeholder="e.g. 0001234567890"
                className="w-full px-3 py-2 border border-input bg-background text-text-strong rounded-xl font-mono text-sm focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-10.5 placeholder:text-text-muted"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-normal text-text-strong">
                Account Label / Alias *
              </label>
              <input
                type="text"
                required
                value={formData.account_label}
                onChange={(e) =>
                  setFormData({ ...formData, account_label: e.target.value })
                }
                placeholder="e.g. Main SCB Account"
                className="w-full px-3 py-2 border border-input bg-background text-text-strong rounded-xl text-sm focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-10.5 placeholder:text-text-muted"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-normal text-text-strong">
                Bank Name
              </label>
              <input
                type="text"
                value={formData.bank_name}
                onChange={(e) =>
                  setFormData({ ...formData, bank_name: e.target.value })
                }
                placeholder="Standard Chartered Bank"
                className="w-full px-3 py-2 border border-input bg-background text-text-strong rounded-xl text-sm focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-10.5 placeholder:text-text-muted"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs sm:text-sm text-text-strong">
              <input
                type="checkbox"
                checked={formData.is_default}
                onChange={(e) =>
                  setFormData({ ...formData, is_default: e.target.checked })
                }
                className="size-4 text-primary rounded border-input focus:ring-ring/20"
              />
              <span className="font-medium">Set as Default Debit Account</span>
            </label>

            <Button
              type="submit"
              disabled={saving}
              className="gap-2 cursor-pointer"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              <span>Save to Database</span>
            </Button>
          </div>
        </form>
      </div>

      {/* Account List */}
      <div className="bg-card rounded-2xl shadow-xs border border-border overflow-hidden flex flex-col">
        <div className="p-4 sm:p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-text-strong">
              Saved Debit Accounts
            </h2>
            <span className="text-xs text-text-muted">({accounts.length})</span>
          </div>

          <div className="relative w-full sm:w-60">
            <Search className="size-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search accounts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-1.5 border border-input rounded-xl text-sm bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 placeholder:text-text-muted"
            />
          </div>
        </div>

        {loading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-text-muted border-b border-border text-xs uppercase font-medium">
                <tr>
                  <th className="py-2.5 px-4">Label</th>
                  <th className="py-2.5 px-4">Account Number</th>
                  <th className="py-2.5 px-4">Bank</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <TableRowsSkeleton rows={4} columns={5} />
              </tbody>
            </table>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="p-12 text-center text-text-muted flex flex-col items-center gap-1">
            <CreditCard className="size-8 opacity-40 mb-1" />
            <p className="font-medium text-text-strong text-sm">
              No debit accounts found
            </p>
            <p className="text-xs text-text-muted">
              {searchQuery
                ? "No accounts match your search filter."
                : "Add your first SCB debit account above to have it auto-load in the generator."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-text-muted border-b border-border text-xs uppercase font-medium">
                <tr>
                  <th className="py-2.5 px-4">Label</th>
                  <th className="py-2.5 px-4">Account Number</th>
                  <th className="py-2.5 px-4">Bank</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredAccounts.map((acc) => (
                  <tr
                    key={acc.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3 px-4 font-normal text-text-strong">
                      {acc.account_label}
                    </td>
                    <td className="py-3 px-4 font-mono text-text-muted text-xs">
                      {acc.account_number}
                    </td>
                    <td className="py-3 px-4 text-text-default">
                      {acc.bank_name || "Standard Chartered Bank"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {acc.is_default ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                          <Star className="size-3 fill-current" />
                          Default
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(acc)}
                          className="text-xs text-text-muted hover:text-text-strong transition-colors cursor-pointer"
                        >
                          Set Default
                        </button>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(acc)}
                          className="size-8 text-text-muted hover:text-text-strong"
                          title="Edit Account"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingAccount(acc)}
                          className="size-8 text-text-muted hover:text-destructive hover:bg-destructive/10"
                          title="Delete Account"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingAccount && (
        <Modal
          isOpen={!!editingAccount}
          onClose={() => setEditingAccount(null)}
          title={editingAccount.id ? "Edit Debit Account" : "Add Debit Account"}
          subtitle="Manage your company's debit accounts for SCB transfers."
          maxWidth="md"
        >
          <form onSubmit={handleSaveEdit} className="p-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-normal text-text-strong">
                Debit Account Number *
              </label>
              <input
                type="text"
                required
                value={editFormData.account_number}
                onChange={(e) =>
                  setEditFormData({
                    ...editFormData,
                    account_number: e.target.value,
                  })
                }
                className="w-full border border-input rounded-xl px-3 py-2 font-mono text-sm bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-10.5"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-normal text-text-strong">
                Account Label *
              </label>
              <input
                type="text"
                required
                value={editFormData.account_label}
                onChange={(e) =>
                  setEditFormData({
                    ...editFormData,
                    account_label: e.target.value,
                  })
                }
                className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-10.5"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-normal text-text-strong">
                Bank Name
              </label>
              <input
                type="text"
                value={editFormData.bank_name}
                onChange={(e) =>
                  setEditFormData({
                    ...editFormData,
                    bank_name: e.target.value,
                  })
                }
                className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-10.5"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-xs sm:text-sm text-text-strong pt-1">
              <input
                type="checkbox"
                checked={editFormData.is_default}
                disabled={editingAccount?.is_default}
                onChange={(e) =>
                  setEditFormData({
                    ...editFormData,
                    is_default: e.target.checked,
                  })
                }
                className="size-4 text-primary rounded border-input"
              />
              <span className="font-medium">Mark as Default Account</span>
            </label>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingAccount(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={editSaving}
                className="cursor-pointer"
              >
                {editSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!deletingAccount}
        onClose={() => setDeletingAccount(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Account?"
        description="Are you sure you want to remove this debit account? This action cannot be undone."
        itemName={
          deletingAccount
            ? `${deletingAccount.account_label} (${deletingAccount.account_number})`
            : undefined
        }
        isDeleting={isDeleting}
      />
    </div>
  );
}
