"use client";

import {
  createPaymentAccount,
  deletePaymentAccount,
  getPaymentAccounts,
} from "@/actions";
import { ConfirmDeleteModal } from "@/components/modals/ConfirmDeleteModal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { PaymentAccount, PaymentAccountFormData } from "@/types";
import { CreditCard, Landmark, MapPin, Plus, Trash2, User } from "lucide-react";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";

function normalizeAccount(acc: Record<string, unknown>): PaymentAccount {
  let detailsObj: Record<string, string> = {};
  if (
    typeof acc.account_details === "string" &&
    acc.account_details.trim().startsWith("{")
  ) {
    try {
      detailsObj = JSON.parse(acc.account_details);
    } catch {}
  }
  const getStr = (val: unknown) => (typeof val === "string" ? val : "");
  return {
    id: getStr(acc.id),
    bank_name:
      getStr(acc.bank_name) ||
      detailsObj.bank_name ||
      getStr(acc.account_name) ||
      "",
    bank_address: getStr(acc.bank_address) || detailsObj.bank_address || "",
    name_on_account:
      getStr(acc.name_on_account) || detailsObj.name_on_account || "",
    bic_swift: getStr(acc.bic_swift) || detailsObj.bic_swift || "",
    account_number:
      getStr(acc.account_number) || detailsObj.account_number || "",
    account_name: getStr(acc.account_name),
    account_details: getStr(acc.account_details),
    created_at: typeof acc.created_at === "string" ? acc.created_at : undefined,
  };
}

export default function SettingsClient({
  initialAccounts,
}: {
  initialAccounts: PaymentAccount[];
}) {
  const [accounts, setAccounts] = useState<PaymentAccount[]>(
    initialAccounts.map(normalizeAccount as any),
  );
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PaymentAccountFormData>();

  const fetchAccounts = useCallback(async () => {
    try {
      const data = await getPaymentAccounts();
      setAccounts(data.map(normalizeAccount as any));
    } catch (error: any) {
      console.error("Error fetching accounts:", error.message);
    }
    setLoading(false);
  }, []);

  const onSubmit = async (data: PaymentAccountFormData) => {
    const cleanBankName = data.bank_name?.trim();
    const cleanNameOnAccount = data.name_on_account?.trim();
    const cleanAccountNumber = data.account_number?.trim();
    const cleanBicSwift = data.bic_swift
      ? data.bic_swift.trim().toUpperCase().replace(/\s+/g, "")
      : null;
    const cleanBankAddress = data.bank_address?.trim() || null;

    if (!cleanBankName) {
      alert("Bank Name is required.");
      return;
    }
    if (!cleanNameOnAccount) {
      alert("Name on Account is required.");
      return;
    }
    if (!cleanAccountNumber) {
      alert("Account / IBAN Number is required.");
      return;
    }

    setSubmitting(true);
    const accountName = cleanBankName;
    const accountDetails = [
      `Name on Account: ${cleanNameOnAccount}`,
      `IBAN/Account Number/Account ID: ${cleanAccountNumber}`,
      cleanBicSwift ? `BIC/SWIFT: ${cleanBicSwift}` : "",
      cleanBankAddress ? `Bank Address: ${cleanBankAddress}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const payload = {
      bank_name: cleanBankName,
      bank_address: cleanBankAddress,
      name_on_account: cleanNameOnAccount,
      bic_swift: cleanBicSwift,
      account_number: cleanAccountNumber,
      account_name: accountName,
      account_details: accountDetails,
    } as any;

    try {
      await createPaymentAccount(payload);
      reset();
      await fetchAccounts();
    } catch (error: any) {
      console.error("Error saving account:", error.message);
      alert(
        "Unable to save bank account. Please verify details and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const [deletingAccount, setDeletingAccount] = useState<PaymentAccount | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!deletingAccount) return;
    setIsDeleting(true);
    try {
      await deletePaymentAccount(deletingAccount.id);
      await fetchAccounts();
      setDeletingAccount(null);
    } catch (error: any) {
      console.error("Error deleting account:", error.message);
      alert("Unable to delete account. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-8 pb-16">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-strong">
          Configuration
        </h1>
        <p className="text-sm text-text-muted mt-1">
          Manage payout bank accounts and payment credentials.
        </p>
      </div>

      {/* Add Payment Account Card */}
      <div className="bg-card rounded-2xl shadow-xs border border-border overflow-hidden flex flex-col">
        <div className="px-5 sm:px-6 py-4 border-b border-border bg-muted/20">
          <h2 className="text-base font-bold text-text-strong">
            Add Bank / Payment Account
          </h2>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="p-5 sm:p-6 flex flex-col gap-4 sm:gap-5"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {/* Bank Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm font-semibold text-text-strong">
                Bank Name *
              </label>
              <input
                {...register("bank_name", {
                  required: "Bank Name is required",
                })}
                maxLength={120}
                className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-10.5 placeholder:text-text-muted"
                placeholder="e.g. Standard Chartered Bank or Wise"
              />
              {errors.bank_name && (
                <p className="text-xs text-destructive">
                  {errors.bank_name.message}
                </p>
              )}
            </div>

            {/* Name on Account */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm font-semibold text-text-strong">
                Name on Account *
              </label>
              <input
                {...register("name_on_account", {
                  required: "Name on Account is required",
                })}
                maxLength={120}
                className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-10.5 placeholder:text-text-muted"
                placeholder="e.g. Themefisher LLC"
              />
              {errors.name_on_account && (
                <p className="text-xs text-destructive">
                  {errors.name_on_account.message}
                </p>
              )}
            </div>

            {/* IBAN / Account Number */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm font-semibold text-text-strong">
                IBAN / Account Number *
              </label>
              <input
                {...register("account_number", {
                  required: "Account Number is required",
                })}
                maxLength={50}
                className="w-full border border-input rounded-xl px-3 py-2 text-sm font-mono bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-10.5 placeholder:text-text-muted"
                placeholder="e.g. 0001234567890"
              />
              {errors.account_number && (
                <p className="text-xs text-destructive">
                  {errors.account_number.message}
                </p>
              )}
            </div>

            {/* BIC / SWIFT */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm font-semibold text-text-strong">
                BIC / SWIFT
              </label>
              <input
                {...register("bic_swift")}
                maxLength={20}
                className="w-full border border-input rounded-xl px-3 py-2 text-sm font-mono bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 min-h-10.5 placeholder:text-text-muted"
                placeholder="e.g. SCBLBDDX"
              />
            </div>

            {/* Bank Address */}
            <div className="md:col-span-2 flex flex-col gap-1.5">
              <label className="text-xs sm:text-sm font-semibold text-text-strong">
                Bank Address
              </label>
              <textarea
                {...register("bank_address")}
                rows={2}
                maxLength={300}
                className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background text-text-strong focus:border-ring focus:ring-2 focus:ring-ring/20 placeholder:text-text-muted"
                placeholder="e.g. 1 Basinghall Avenue, London, EC2V 5DD"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              type="submit"
              disabled={submitting}
              className="gap-2 cursor-pointer"
            >
              <Plus className="size-4" />
              <span>{submitting ? "Saving..." : "Add Bank Account"}</span>
            </Button>
          </div>
        </form>
      </div>

      {/* Existing Accounts List */}
      <div className="bg-card rounded-2xl shadow-xs border border-border overflow-hidden flex flex-col">
        <div className="px-5 sm:px-6 py-4 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-text-strong">
              Existing Accounts
            </h2>
            <span className="text-xs text-text-muted">({accounts.length})</span>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {loading ? (
            <div className="grid grid-cols-1 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="border border-border rounded-xl p-4 bg-background flex justify-between items-start gap-4"
                >
                  <div className="flex flex-col gap-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-44 rounded" />
                      <Skeleton className="h-4 w-16 rounded-full" />
                    </div>
                    <Skeleton className="h-3.5 w-64 rounded" />
                    <Skeleton className="h-3 w-40 rounded" />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Skeleton className="h-8 w-8 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-10 text-text-muted flex flex-col items-center gap-2">
              <Landmark className="size-8 opacity-40" />
              <p className="text-sm font-medium text-text-strong">
                No payment accounts configured yet.
              </p>
              <p className="text-xs text-text-muted">
                Add your bank account details above to use them in invoices.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="border border-border rounded-xl p-4 bg-background hover:bg-muted/20 transition-colors flex justify-between items-start gap-4"
                >
                  <div className="flex flex-col gap-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-text-strong text-sm sm:text-base">
                        {acc.bank_name || acc.account_name || "Unnamed Bank"}
                      </span>
                      {acc.bic_swift && (
                        <span className="text-xs font-mono text-text-muted">
                          SWIFT: {acc.bic_swift}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
                      {acc.name_on_account && (
                        <div className="flex items-center gap-1.5 text-text-muted">
                          <User className="size-3.5 text-text-muted shrink-0" />
                          <span>
                            Name:{" "}
                            <strong className="text-text-strong font-medium">
                              {acc.name_on_account}
                            </strong>
                          </span>
                        </div>
                      )}

                      {acc.account_number && (
                        <div className="flex items-center gap-1.5 text-text-muted">
                          <CreditCard className="size-3.5 text-text-muted shrink-0" />
                          <span>
                            A/C:{" "}
                            <span className="font-mono text-text-strong">
                              {acc.account_number}
                            </span>
                          </span>
                        </div>
                      )}

                      {acc.bank_address && (
                        <div className="flex items-start gap-1.5 text-text-muted sm:col-span-2 mt-0.5">
                          <MapPin className="size-3.5 text-text-muted shrink-0 mt-0.5" />
                          <span>{acc.bank_address}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeletingAccount(acc)}
                    title="Delete account"
                    className="size-8 text-text-muted hover:text-destructive hover:bg-destructive/10 shrink-0 cursor-pointer"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDeleteModal
        isOpen={!!deletingAccount}
        onClose={() => setDeletingAccount(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Bank Account?"
        description="Are you sure you want to permanently delete this bank account? This action cannot be undone."
        itemName={
          deletingAccount?.bank_name
            ? `${deletingAccount.bank_name} (${deletingAccount.account_number})`
            : undefined
        }
        isDeleting={isDeleting}
      />
    </div>
  );
}
