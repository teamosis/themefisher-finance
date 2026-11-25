"use client";

import {
  createVendor,
  deleteVendor as deleteVendorAction,
  updateVendor,
} from "@/actions";
import { ConfirmDeleteModal } from "@/components/modals/confirm-delete-modal";
import { Modal } from "@/components/modals/modal";
import { TableRowsSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import type { Vendor } from "@/types";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

const BankBranchSelect = dynamic(
  () => import("@/components/forms/bank-branch-select"),
  {
    ssr: false,
    loading: () => <div className="animate-pulse bg-muted rounded-md h-10" />,
  },
);

import {
  AlertCircle,
  AlertTriangle,
  Check,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

export default function VendorsClient({
  initialVendors,
}: {
  initialVendors: Vendor[];
}) {
  const [vendors, setVendors] = useState<Vendor[]>(initialVendors);
  const [loading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<
    "all" | "employees" | "others" | "hidden"
  >("all");
  const [duplicateVendor, setDuplicateVendor] = useState<Vendor | null>(null);
  const [duplicatePendingPayload, setDuplicatePendingPayload] =
    useState<any>(null);
  const [inlineDuplicateWarning, setInlineDuplicateWarning] = useState<
    string | null
  >(null);

  // Add Form state
  const [formData, setFormData] = useState({
    receiver_name: "",
    account_number: "",
    bank_name: "",
    branch_name: "",
    routing_number: "",
    is_employee: false,
    salary: "",
  });

  // Edit State
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [editFormData, setEditFormData] = useState({
    receiver_name: "",
    account_number: "",
    bank_name: "",
    branch_name: "",
    routing_number: "",
    is_employee: false,
    salary: "",
  });
  const [editSaving, setEditSaving] = useState(false);

  // Delete State
  const [deletingVendor, setDeletingVendor] = useState<Vendor | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isHiding, setIsHiding] = useState(false);

  const [prevInitialVendors, setPrevInitialVendors] = useState(initialVendors);
  if (initialVendors !== prevInitialVendors) {
    setPrevInitialVendors(initialVendors);
    setVendors(initialVendors || []);
  }

  const triggerSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => {
      setSuccessMessage((current) => (current === msg ? null : current));
    }, 4000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleNameBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const val = e.target.value.trim().toLowerCase();
    if (!val) {
      setInlineDuplicateWarning(null);
      return;
    }

    const existing = vendors.find(
      (v) => v.receiver_name.trim().toLowerCase() === val,
    );
    if (existing) {
      setInlineDuplicateWarning(
        existing.is_hidden
          ? `A hidden account already exists with name "${existing.receiver_name}".`
          : `An active account already exists with name "${existing.receiver_name}".`,
      );
    } else {
      setInlineDuplicateWarning(null);
    }
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setEditFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleToggleEmployee = async (vendor: Vendor) => {
    const newStatus = !vendor.is_employee;
    try {
      await updateVendor(vendor.id, { is_employee: newStatus });
      setVendors((prev) =>
        prev.map((v) =>
          v.id === vendor.id ? { ...v, is_employee: newStatus } : v,
        ),
      );
      triggerSuccess(
        `${newStatus ? "Marked" : "Unmarked"} "${vendor.receiver_name}" as employee!`,
      );
    } catch (error: any) {
      console.error("Failed to toggle employee status:", error);
      toast.error(`Could not update employee status: ${error.message}`);
    }
  };

  const handleToggleHide = async (vendor: Vendor) => {
    const newHidden = !vendor.is_hidden;
    try {
      await updateVendor(vendor.id, { is_hidden: newHidden });
      setVendors((prev) =>
        prev.map((v) =>
          v.id === vendor.id ? { ...v, is_hidden: newHidden } : v,
        ),
      );
      triggerSuccess(
        `${newHidden ? "Hidden" : "Unhidden"} "${vendor.receiver_name}".`,
      );
    } catch (error: any) {
      console.error("Failed to toggle hide status:", error);
      toast.error(`Could not update hidden status: ${error.message}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMessage(null);

    const payload = {
      receiver_name: formData.receiver_name.trim(),
      account_number: formData.account_number.trim(),
      bank_name: formData.bank_name.trim(),
      branch_name: formData.branch_name.trim(),
      routing_number: formData.routing_number.trim(),
      is_employee: formData.is_employee,
      salary: formData.salary ? Number(formData.salary) : 0,
    };

    const duplicate = vendors.find(
      (v) =>
        v.receiver_name.trim().toLowerCase() ===
        payload.receiver_name.toLowerCase(),
    );

    if (duplicate) {
      setDuplicateVendor(duplicate);
      setDuplicatePendingPayload(payload);
      setSaving(false);
      return;
    }

    await executeCreate(payload, formData.is_employee);
  };

  const executeCreate = async (payload: any, isEmployee: boolean) => {
    try {
      const created = await createVendor(payload);
      const newVendor: Vendor = {
        id: (created as any)?.id || crypto.randomUUID(),
        ...payload,
        is_employee: isEmployee,
        is_hidden: false,
      };

      setVendors((prev) => [newVendor, ...prev]);
      setFormData({
        receiver_name: "",
        account_number: "",
        bank_name: "",
        branch_name: "",
        routing_number: "",
        is_employee: false,
        salary: "",
      });
      triggerSuccess(`Added "${payload.receiver_name}" successfully!`);
    } catch (error: any) {
      setErrorMessage(error.message);
      toast.error(`Failed to save vendor: ${error.message}`);
    } finally {
      setSaving(false);
      setDuplicateVendor(null);
      setDuplicatePendingPayload(null);
    }
  };

  const handleConfirmCreateDuplicate = () => {
    if (duplicatePendingPayload) {
      executeCreate(duplicatePendingPayload, formData.is_employee);
    }
  };

  const handleActivateOldAccount = async () => {
    if (duplicateVendor) {
      await handleToggleHide(duplicateVendor);
      setDuplicateVendor(null);
      setDuplicatePendingPayload(null);
      setFormData({
        receiver_name: "",
        account_number: "",
        bank_name: "",
        branch_name: "",
        routing_number: "",
        is_employee: false,
        salary: "",
      });
    }
  };

  // Start Edit
  const handleStartEdit = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setEditFormData({
      receiver_name: vendor.receiver_name,
      account_number: vendor.account_number,
      bank_name: vendor.bank_name,
      branch_name: vendor.branch_name,
      routing_number: vendor.routing_number,
      is_employee: Boolean(vendor.is_employee),
      salary: vendor.salary ? String(vendor.salary) : "",
    });
  };

  // Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVendor) return;

    setEditSaving(true);
    setErrorMessage(null);

    const updatePayload: Record<string, any> = {
      receiver_name: editFormData.receiver_name,
      account_number: editFormData.account_number,
      bank_name: editFormData.bank_name,
      branch_name: editFormData.branch_name,
      routing_number: editFormData.routing_number,
      is_employee: editFormData.is_employee,
      salary: editFormData.salary ? Number(editFormData.salary) : 0,
    };

    try {
      await updateVendor(editingVendor.id, updatePayload);
      setVendors((prev) =>
        prev.map((v) =>
          v.id === editingVendor.id
            ? {
                ...v,
                ...editFormData,
                salary: editFormData.salary ? Number(editFormData.salary) : 0,
              }
            : v,
        ),
      );
      triggerSuccess(`Updated "${editFormData.receiver_name}" successfully!`);
      setEditingVendor(null);
    } catch (error: any) {
      console.error(error);
      toast.error(`Failed to update vendor: ${error.message}`);
    }
    setEditSaving(false);
  };

  const handleHideVendor = async () => {
    if (!deletingVendor) return;
    setIsHiding(true);
    const targetId = deletingVendor.id;
    const targetName = deletingVendor.receiver_name;

    try {
      await updateVendor(targetId, { is_hidden: true });
      setVendors((prev) =>
        prev.map((v) => (v.id === targetId ? { ...v, is_hidden: true } : v)),
      );
      triggerSuccess(`Hidden vendor "${targetName}".`);
      setDeletingVendor(null);
    } catch (error: any) {
      console.error(error);
      toast.error(`Failed to hide vendor: ${error.message}`);
    }
    setIsHiding(false);
  };

  const handleConfirmDelete = async () => {
    if (!deletingVendor) return;

    setIsDeleting(true);
    const targetId = deletingVendor.id;
    const targetName = deletingVendor.receiver_name;

    try {
      await deleteVendorAction(targetId);
      setVendors((prev) => prev.filter((v) => v.id !== targetId));
      triggerSuccess(`Deleted vendor "${targetName}".`);
      setDeletingVendor(null);
    } catch (error: any) {
      console.error(error);
      toast.error(`Failed to delete vendor: ${error.message}`);
    }
    setIsDeleting(false);
  };

  // Filtered counts
  const employeeCount = useMemo(
    () => vendors.filter((v) => v.is_employee && !v.is_hidden).length,
    [vendors],
  );

  const hiddenCount = useMemo(
    () => vendors.filter((v) => v.is_hidden).length,
    [vendors],
  );
  const visibleCount = vendors.length - hiddenCount;

  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
      if (activeTab === "hidden") return Boolean(v.is_hidden);
      if (v.is_hidden) return false;

      if (activeTab === "employees" && !v.is_employee) return false;
      if (activeTab === "others" && v.is_employee) return false;

      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        v.receiver_name.toLowerCase().includes(q) ||
        v.account_number.toLowerCase().includes(q) ||
        v.bank_name.toLowerCase().includes(q) ||
        (v.branch_name && v.branch_name.toLowerCase().includes(q)) ||
        (v.routing_number && v.routing_number.toLowerCase().includes(q))
      );
    });
  }, [vendors, activeTab, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6 pb-16">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-strong">
          Receiver Bank Accounts
        </h1>
        <p className="text-sm text-text-muted mt-1">
          Add, edit, and mark employees or vendor beneficiary bank accounts.
        </p>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="bg-success/10 border border-success/20 text-success px-4 py-3 rounded-xl flex items-center justify-between shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2 font-medium text-xs sm:text-sm">
            <Check className="size-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-success hover:opacity-75 p-1 rounded-lg cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-destructive flex items-start gap-3">
          <AlertCircle className="size-5 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm">
            <p className="font-medium">Database Error</p>
            <p className="mt-1">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Add New Receiver Form */}
      <div className="bg-card p-4 sm:p-6 rounded-2xl shadow-xs border border-border flex flex-col gap-4">
        <h2 className="text-base font-bold text-text-strong">
          Add New Receiver Account
        </h2>
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4"
        >
          <div className="flex flex-col gap-1.5 relative">
            <Label className="text-sm font-normal text-text-strong">
              Receiver / Employee Name *
            </Label>
            <Input
              required
              type="text"
              name="receiver_name"
              value={formData.receiver_name}
              onChange={handleChange}
              onBlur={handleNameBlur}
              className={
                inlineDuplicateWarning
                  ? "border-warning bg-warning/5"
                  : undefined
              }
              placeholder="e.g. John Doe"
            />
            {inlineDuplicateWarning && (
              <p className="text-xs font-medium text-warning flex items-center gap-1 mt-1">
                <AlertTriangle className="size-3" />
                {inlineDuplicateWarning}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-normal text-text-strong">
              Account Number *
            </Label>
            <Input
              required
              type="text"
              name="account_number"
              value={formData.account_number}
              onChange={handleChange}
              placeholder="1234567890"
            />
          </div>

          <BankBranchSelect
            bankName={formData.bank_name}
            branchName={formData.branch_name}
            routingNumber={formData.routing_number}
            onBankChange={(val) =>
              setFormData((prev) => ({ ...prev, bank_name: val }))
            }
            onBranchChange={(val) =>
              setFormData((prev) => ({ ...prev, branch_name: val }))
            }
            onRoutingChange={(val) =>
              setFormData((prev) => ({ ...prev, routing_number: val }))
            }
          />

          {/* Employee Option & Default Salary */}
          <div className="sm:col-span-2 lg:col-span-3 pt-3 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  name="is_employee"
                  checked={formData.is_employee}
                  onChange={handleChange}
                  className="size-4 rounded border-input text-primary focus:ring-ring/20"
                />
                <span className="text-sm font-medium text-text-strong">
                  Mark as Employee (Included in Salary Sheets)
                </span>
              </label>

              {formData.is_employee && (
                <div className="inline-flex items-center gap-2">
                  <Label className="text-xs sm:text-sm text-text-muted font-medium whitespace-nowrap">
                    Default Salary (BDT):
                  </Label>
                  <Input
                    type="number"
                    name="salary"
                    value={formData.salary}
                    onChange={handleChange}
                    placeholder="e.g. 50000"
                    className="w-36 h-9"
                  />
                </div>
              )}
            </div>

            <Button
              type="submit"
              loading={saving}
              className="self-start sm:self-auto"
            >
              {!saving && <Plus />}
              <span>Save Receiver</span>
            </Button>
          </div>
        </form>
      </div>

      {/* Receiver Bank AC Container */}
      <div className="bg-card rounded-2xl shadow-xs border border-border overflow-hidden flex flex-col">
        <div className="px-4 sm:px-6 py-4 border-b border-border bg-muted/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-3.5">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-text-strong">
              Receivers List
            </h2>
            <span className="text-xs text-text-muted">({vendors.length})</span>
          </div>

          {/* Filter Tabs & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            {/* Filter Tabs */}
            <div className="inline-flex p-1 bg-muted rounded-xl text-xs font-medium self-start sm:self-auto gap-0.5">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === "all"
                    ? "bg-background text-text-strong shadow-2xs font-medium"
                    : "text-text-muted hover:text-text-strong"
                }`}
              >
                All ({visibleCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("employees")}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === "employees"
                    ? "bg-background text-text-strong shadow-2xs font-medium"
                    : "text-text-muted hover:text-text-strong"
                }`}
              >
                Employees ({employeeCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("others")}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === "others"
                    ? "bg-background text-text-strong shadow-2xs font-medium"
                    : "text-text-muted hover:text-text-strong"
                }`}
              >
                Vendors ({visibleCount - employeeCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("hidden")}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === "hidden"
                    ? "bg-background text-text-strong shadow-2xs font-medium"
                    : "text-text-muted hover:text-text-strong"
                }`}
              >
                Hidden ({hiddenCount})
              </button>
            </div>

            {/* Search Box */}
            <div className="relative w-full sm:w-60">
              <Search className="size-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Search receivers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 h-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-strong"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/40 text-text-muted border-b border-border text-xs uppercase font-medium">
                <tr>
                  <th className="px-5 py-3">Receiver Name</th>
                  <th className="px-4 py-3 text-center w-36">
                    Employee Status
                  </th>
                  <th className="px-5 py-3">Account Number</th>
                  <th className="px-5 py-3">Bank Name</th>
                  <th className="px-5 py-3">Branch Name</th>
                  <th className="px-5 py-3">Routing Number</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <TableRowsSkeleton rows={6} columns={7} />
              </tbody>
            </table>
          </div>
        ) : vendors.length === 0 ? (
          <div className="p-12 text-center text-text-muted text-sm">
            No receivers found. Add one using the form above.
          </div>
        ) : filteredVendors.length === 0 ? (
          <div className="p-12 text-center text-text-muted text-sm">
            No receivers match the selected filter or search query.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/40 text-text-muted border-b border-border text-xs uppercase font-medium">
                <tr>
                  <th className="px-5 py-3">Receiver Name</th>
                  <th className="px-4 py-3 text-center w-36">
                    Employee Status
                  </th>
                  <th className="px-5 py-3">Account Number</th>
                  <th className="px-5 py-3">Bank Name</th>
                  <th className="px-5 py-3">Branch Name</th>
                  <th className="px-5 py-3">Routing Number</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredVendors.map((v) => (
                  <tr
                    key={v.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-5 py-3.5 font-normal text-text-strong">
                      <div className="flex items-center gap-2">
                        <span>{v.receiver_name}</span>
                        {v.salary ? (
                          <span className="text-xs text-text-muted">
                            ৳{Number(v.salary).toLocaleString()}
                          </span>
                        ) : null}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <Button
                        type="button"
                        variant={v.is_employee ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => handleToggleEmployee(v)}
                        className="h-7 text-xs gap-1.5 cursor-pointer"
                      >
                        {v.is_employee ? (
                          <>
                            <Check className="size-3 text-primary stroke-[2.5]" />
                            <span>Employee</span>
                          </>
                        ) : (
                          <span className="text-text-muted">Vendor</span>
                        )}
                      </Button>
                    </td>

                    <td className="px-5 py-3.5 text-xs text-text-muted">
                      {v.account_number}
                    </td>
                    <td className="px-5 py-3.5 text-text-default">
                      {v.bank_name}
                    </td>
                    <td className="px-5 py-3.5 text-text-muted">
                      {v.branch_name || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-text-muted">
                      {v.routing_number || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleHide(v)}
                          className="h-8 text-xs text-text-muted hover:text-text-strong"
                          title={v.is_hidden ? "Unhide" : "Hide"}
                        >
                          {v.is_hidden ? "Unhide" : "Hide"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleStartEdit(v)}
                          className="size-8 text-text-muted hover:text-text-strong"
                          title="Edit receiver"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingVendor(v)}
                          className="size-8 text-text-muted hover:text-destructive hover:bg-destructive/10"
                          title="Delete receiver"
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

      {/* Edit Vendor Modal Dialog */}
      {editingVendor && (
        <Modal
          isOpen={!!editingVendor}
          onClose={() => setEditingVendor(null)}
          title="Edit Receiver Account"
          subtitle="Modify beneficiary banking and employee status."
          maxWidth="lg"
        >
          <form
            onSubmit={handleSaveEdit}
            className="flex flex-col h-full w-full max-h-[75vh]"
          >
            <div className="p-5 sm:p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-normal text-text-strong">
                  Receiver / Employee Name *
                </Label>
                <Input
                  required
                  type="text"
                  name="receiver_name"
                  value={editFormData.receiver_name}
                  onChange={handleEditChange}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm font-normal text-text-strong">
                    Account Number *
                  </Label>
                  <Input
                    required
                    type="text"
                    name="account_number"
                    value={editFormData.account_number}
                    onChange={handleEditChange}
                  />
                </div>
                <BankBranchSelect
                  bankName={editFormData.bank_name}
                  branchName={editFormData.branch_name}
                  routingNumber={editFormData.routing_number}
                  onBankChange={(val) =>
                    setEditFormData((prev) => ({ ...prev, bank_name: val }))
                  }
                  onBranchChange={(val) =>
                    setEditFormData((prev) => ({ ...prev, branch_name: val }))
                  }
                  onRoutingChange={(val) =>
                    setEditFormData((prev) => ({
                      ...prev,
                      routing_number: val,
                    }))
                  }
                />
              </div>

              {/* Employee checkmark in Edit */}
              <div className="pt-3 border-t border-border flex flex-col gap-3">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    name="is_employee"
                    checked={editFormData.is_employee}
                    onChange={handleEditChange}
                    className="size-4 rounded border-input text-primary focus:ring-ring/20"
                  />
                  <span className="text-sm font-medium text-text-strong">
                    Mark as Employee (Included in Salary Sheets)
                  </span>
                </label>

                {editFormData.is_employee && (
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-normal text-text-strong">
                      Default Monthly Salary (BDT)
                    </Label>
                    <Input
                      type="number"
                      name="salary"
                      value={editFormData.salary}
                      onChange={handleEditChange}
                      placeholder="e.g. 50000"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-muted/40 border-t border-border flex items-center justify-end gap-3 shrink-0">
              <Button
                type="button"
                variant="outline"
                disabled={editSaving}
                onClick={() => setEditingVendor(null)}
              >
                Cancel
              </Button>
              <Button type="submit" loading={editSaving}>
                {!editSaving && <Check />}
                <span>Save Changes</span>
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Modal Dialog */}
      <ConfirmDeleteModal
        isOpen={!!deletingVendor}
        onClose={() => setDeletingVendor(null)}
        onConfirm={handleConfirmDelete}
        onHide={handleHideVendor}
        title="Delete Receiver Account?"
        description="Are you sure you want to remove this receiver account? You can hide it instead of permanently deleting it from the database."
        itemName={
          deletingVendor
            ? `${deletingVendor.receiver_name} (A/C: ${deletingVendor.account_number})`
            : undefined
        }
        isDeleting={isDeleting}
        isHiding={isHiding}
      />

      {duplicateVendor && (
        <Modal
          isOpen={!!duplicateVendor}
          onClose={() => {
            setDuplicateVendor(null);
            setDuplicatePendingPayload(null);
          }}
          title={
            duplicateVendor.is_hidden
              ? "Hidden Account Found"
              : "Duplicate Account Found"
          }
          icon={<AlertTriangle className="size-5 text-warning" />}
          maxWidth="sm"
        >
          <div className="p-6 flex flex-col gap-4 text-center">
            <p className="text-sm text-text-muted">
              An account named{" "}
              <span className="text-text-strong font-normal">
                {duplicateVendor.receiver_name}
              </span>{" "}
              already exists
              {duplicateVendor.is_hidden
                ? " but is currently hidden."
                : " and is active."}
            </p>
            <div className="p-3 bg-muted/40 rounded-xl border border-border text-xs text-text-muted text-left">
              <p>A/C: {duplicateVendor.account_number}</p>
              <p>Bank: {duplicateVendor.bank_name}</p>
            </div>
          </div>

          <div className="p-4 bg-muted/40 border-t border-border flex flex-col gap-2">
            {duplicateVendor.is_hidden ? (
              <Button
                type="button"
                onClick={handleActivateOldAccount}
                className="w-full"
              >
                Activate Old Account
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={handleConfirmCreateDuplicate}
              className="w-full"
            >
              Create New Account Anyway
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDuplicateVendor(null);
                setDuplicatePendingPayload(null);
              }}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
