"use client";

import { submitPaymentRequest } from "@/actions";
import BankBranchSelect from "@/components/forms/bank-branch-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PaymentRequestFormData } from "@/types";
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  FileText,
  Send,
  User,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

const initialFormState: PaymentRequestFormData = {
  payeeName: "",
  payeeEmail: "",
  payeePhone: "",
  bankName: "",
  branchName: "",
  routingNumber: "",
  accountNumber: "",
  confirmAccountNumber: "",
  amount: "",
  purpose: "",
  website_hp: "",
};

export default function PaymentRequestFormClient() {
  const [formData, setFormData] =
    useState<PaymentRequestFormData>(initialFormState);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, startSubmitTransition] = useTransition();

  // Submission success state
  const [submittedResult, setSubmittedResult] = useState<{
    trackingCode: string;
    amount: string;
    payeeName: string;
    bankName: string;
    branchName: string;
    accountNumber: string;
    purpose: string;
  } | null>(null);

  // Copy helper
  const [copiedCode, setCopiedCode] = useState(false);
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Basic client checks
    if (!formData.payeeName.trim()) {
      setFormError("Please enter your legal beneficiary name.");
      return;
    }
    if (!formData.bankName.trim() || !formData.branchName.trim()) {
      setFormError("Please select your bank and branch.");
      return;
    }
    if (
      !formData.routingNumber.trim() ||
      !/^\d{9}$/.test(formData.routingNumber.trim())
    ) {
      setFormError("A valid 9-digit routing number is required.");
      return;
    }
    if (!formData.accountNumber.trim()) {
      setFormError("Please enter your account number.");
      return;
    }
    if (
      formData.accountNumber.trim() !== formData.confirmAccountNumber?.trim()
    ) {
      setFormError("Account numbers do not match. Please verify.");
      return;
    }
    const numAmount = Number(formData.amount);
    if (!formData.amount || !Number.isFinite(numAmount) || numAmount <= 0) {
      setFormError("Please enter a valid payment amount in BDT.");
      return;
    }
    if (!formData.purpose.trim()) {
      setFormError("Please provide the purpose / description of the payment.");
      return;
    }

    startSubmitTransition(async () => {
      try {
        const res = await submitPaymentRequest(formData);
        if (res.success && res.trackingCode) {
          setSubmittedResult({
            trackingCode: res.trackingCode,
            amount: formData.amount,
            payeeName: formData.payeeName,
            bankName: formData.bankName,
            branchName: formData.branchName,
            accountNumber: formData.accountNumber,
            purpose: formData.purpose,
          });
          setFormData(initialFormState);
        } else {
          setFormError(
            res.error || "Failed to submit request. Please try again.",
          );
        }
      } catch {
        setFormError("Could not submit the payment request. Please try again.");
      }
    });
  };

  if (submittedResult) {
    return (
      <div className="max-w-xl mx-auto w-full">
        <Card className="border-success/30 bg-card shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="h-1.5 bg-success w-full" />
          <CardHeader className="text-center p-5 pb-3">
            <div className="size-11 rounded-xl bg-success/10 text-success flex items-center justify-center mx-auto mb-2.5">
              <CheckCircle2 className="size-6" />
            </div>
            <CardTitle className="text-lg sm:text-xl font-bold text-text-strong">
              Payment Request Submitted
            </CardTitle>
          </CardHeader>

          <CardContent className="p-5 pt-0 space-y-3.5">
            {/* Tracking Code Box */}
            <div className="w-full px-3.5 py-2.5 bg-muted/60 border border-border rounded-xl flex items-center justify-between gap-3">
              <div className="text-left min-w-0 flex-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                  Tracking Reference
                </span>
                <span className="text-sm font-bold text-text-strong truncate block">
                  {submittedResult.trackingCode}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleCopyCode(submittedResult.trackingCode)}
                className="shrink-0 gap-1 text-xs h-7.5 px-2.5 cursor-pointer"
              >
                {copiedCode ? (
                  <>
                    <Check className="size-3 text-success" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3" />
                    <span>Copy</span>
                  </>
                )}
              </Button>
            </div>

            <div className="border border-border rounded-xl p-3 bg-background/50 space-y-2 text-xs">
              <div className="flex justify-between py-0.5 border-b border-border/50">
                <span className="text-muted-foreground">Beneficiary</span>
                <span className="font-semibold text-text-strong">
                  {submittedResult.payeeName}
                </span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-border/50">
                <span className="text-muted-foreground">Bank & Branch</span>
                <span className="font-medium text-text-strong text-right">
                  {submittedResult.bankName} ({submittedResult.branchName})
                </span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-border/50">
                <span className="text-muted-foreground">Account</span>
                <span className="font-medium text-text-strong">
                  ••••{submittedResult.accountNumber.slice(-4)}
                </span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-border/50">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-bold text-success">
                  ৳{Number(submittedResult.amount).toLocaleString()} BDT
                </span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-muted-foreground">Purpose</span>
                <span className="text-text-strong font-medium text-right max-w-60 truncate">
                  {submittedResult.purpose}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setSubmittedResult(null);
                  setFormData(initialFormState);
                }}
                className="flex-1 cursor-pointer text-xs"
              >
                Submit Another Request
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
              >
                <Link
                  href={`/track-payment?code=${submittedResult.trackingCode}`}
                >
                  Track Status
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto w-full">
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="p-4 sm:p-5 pb-2">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <CreditCard className="size-4" />
            </div>
            <CardTitle className="text-base sm:text-lg font-bold text-text-strong">
              Beneficiary Payment Form
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5 pt-1">
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Honeypot field */}
            <div style={{ display: "none" }} aria-hidden="true">
              <input
                type="text"
                name="website_hp"
                value={formData.website_hp}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, website_hp: e.target.value }))
                }
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="size-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Section 1: Beneficiary Details */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                <User className="size-3.5" />
                <span>1. Beneficiary Information</span>
              </div>

              <div className="space-y-1">
                <Label htmlFor="payeeName" className="text-xs font-medium">
                  Legal Beneficiary Name{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="payeeName"
                  value={formData.payeeName}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, payeeName: e.target.value }))
                  }
                  placeholder="e.g. Mohammad Rahim or Company Ltd"
                  required
                  disabled={isSubmitting}
                  className="text-xs h-8.5 bg-background"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label htmlFor="payeeEmail" className="text-xs font-medium">
                    Email Address{" "}
                    <span className="text-muted-foreground font-normal">
                      (Optional)
                    </span>
                  </Label>
                  <Input
                    id="payeeEmail"
                    type="email"
                    value={formData.payeeEmail}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, payeeEmail: e.target.value }))
                    }
                    placeholder="name@example.com"
                    disabled={isSubmitting}
                    className="text-xs h-8.5 bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="payeePhone" className="text-xs font-medium">
                    Mobile Number{" "}
                    <span className="text-muted-foreground font-normal">
                      (Optional)
                    </span>
                  </Label>
                  <Input
                    id="payeePhone"
                    value={formData.payeePhone}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, payeePhone: e.target.value }))
                    }
                    placeholder="e.g. 01711XXXXXX"
                    disabled={isSubmitting}
                    className="text-xs h-8.5 bg-background"
                  />
                </div>
              </div>
            </div>

            <div className="h-px bg-border/60 mt-2 mb-3" />

            {/* Section 2: Bank & Account Details */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary pt-0.5">
                <Building2 className="size-3.5" />
                <span>2. Bank Account Details</span>
              </div>

              <BankBranchSelect
                variant="compact"
                disabled={isSubmitting}
                bankName={formData.bankName}
                branchName={formData.branchName}
                routingNumber={formData.routingNumber}
                onBankChange={(val) =>
                  setFormData((p) => ({
                    ...p,
                    bankName: val,
                    branchName: "",
                    routingNumber: "",
                  }))
                }
                onBranchChange={(val) =>
                  setFormData((p) => ({ ...p, branchName: val }))
                }
                onRoutingChange={(val) =>
                  setFormData((p) => ({ ...p, routingNumber: val }))
                }
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-0.5">
                <div className="space-y-1">
                  <Label
                    htmlFor="accountNumber"
                    className="text-xs font-medium"
                  >
                    Account Number <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="accountNumber"
                    value={formData.accountNumber}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        accountNumber: e.target.value,
                      }))
                    }
                    placeholder="Beneficiary account number"
                    required
                    disabled={isSubmitting}
                    className="text-xs h-8.5 bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <Label
                    htmlFor="confirmAccountNumber"
                    className="text-xs font-medium"
                  >
                    Confirm Account Number{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="confirmAccountNumber"
                    value={formData.confirmAccountNumber}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        confirmAccountNumber: e.target.value,
                      }))
                    }
                    placeholder="Re-enter account number"
                    required
                    disabled={isSubmitting}
                    className="text-xs h-8.5 bg-background"
                  />
                </div>
              </div>
            </div>

            <div className="h-px bg-border/60 mt-2 mb-3" />

            {/* Section 3: Amount & Purpose */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary pt-0.5">
                <FileText className="size-3.5" />
                <span>3. Payment Details</span>
              </div>

              <div className="space-y-1">
                <Label htmlFor="amount" className="text-xs font-medium">
                  Claimed Amount (BDT){" "}
                  <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                    ৳
                  </span>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="1"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, amount: e.target.value }))
                    }
                    placeholder="50000"
                    required
                    disabled={isSubmitting}
                    className="text-xs h-8.5 pl-7 bg-background font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="purpose" className="text-xs font-medium">
                  Reason / Purpose <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="purpose"
                  rows={2}
                  value={formData.purpose}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, purpose: e.target.value }))
                  }
                  placeholder="e.g. Design & frontend development for Theme X - Nov 2026"
                  required
                  disabled={isSubmitting}
                  className="text-xs bg-background resize-none"
                />
              </div>
            </div>

            {/* Submission Button */}
            <Button
              type="submit"
              loading={isSubmitting}
              className="w-full mt-1"
            >
              {!isSubmitting && <Send />}
              <span>
                {isSubmitting
                  ? "Submitting Request..."
                  : "Submit Payment Request"}
              </span>
            </Button>

            {/* Link to separate track page */}
            <div className="text-center pt-1.5">
              <Link
                href="/track-payment"
                className="text-xs text-muted-foreground hover:text-text-strong transition-colors hover:underline"
              >
                Already submitted? Track your request status &rarr;
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
