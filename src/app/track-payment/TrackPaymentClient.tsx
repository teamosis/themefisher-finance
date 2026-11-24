"use client";

import { getPaymentRequestByTrackingCode } from "@/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

export default function TrackPaymentClient() {
  const searchParams = useSearchParams();
  const initialCode = searchParams.get("code") || "";

  const [trackCodeInput, setTrackCodeInput] = useState(initialCode);
  const [trackingResult, setTrackingResult] = useState<{
    trackingCode: string;
    payeeName: string;
    bankName: string;
    branchName: string;
    amount: string;
    currency: string;
    purpose: string;
    status: string;
    createdAt: Date | string;
    exportedAt?: Date | string | null;
  } | null | undefined>(undefined);
  const [isTracking, startTrackTransition] = useTransition();
  const [trackError, setTrackError] = useState<string | null>(null);

  const fetchTracking = (code: string) => {
    if (!code.trim()) return;
    setTrackError(null);
    startTrackTransition(async () => {
      const res = await getPaymentRequestByTrackingCode(code.trim());
      if (res) {
        setTrackingResult(res);
        setTrackError(null);
      } else {
        setTrackingResult(null);
        setTrackError("No payment request found matching this tracking reference.");
      }
    });
  };

  useEffect(() => {
    let cancelled = false;
    if (initialCode.trim()) {
      getPaymentRequestByTrackingCode(initialCode.trim()).then((res) => {
        if (!cancelled) {
          if (res) {
            setTrackingResult(res);
            setTrackError(null);
          } else {
            setTrackingResult(null);
            setTrackError(
              "No payment request found matching this tracking reference.",
            );
          }
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [initialCode]);

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackCodeInput.trim()) {
      setTrackError("Please enter a tracking reference code.");
      return;
    }
    fetchTracking(trackCodeInput);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-300"
          >
            <Clock className="size-3" />
            Under Review
          </Badge>
        );
      case "verified":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-300"
          >
            <ShieldCheck className="size-3" />
            Verified & Ready
          </Badge>
        );
      case "approved":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-300"
          >
            <CheckCircle2 className="size-3" />
            Approved
          </Badge>
        );
      case "exported":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-purple-300 text-purple-700 bg-purple-50 dark:bg-purple-950/30 dark:text-purple-300"
          >
            <Check className="size-3" />
            Sent to Bank (Exported)
          </Badge>
        );
      case "rejected":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950/30 dark:text-rose-300"
          >
            <XCircle className="size-3" />
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="max-w-xl mx-auto w-full">
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="p-4 sm:p-5 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Search className="size-4" />
              </div>
              <CardTitle className="text-base sm:text-lg font-bold text-text-strong">
                Track Payment Request
              </CardTitle>
            </div>
            <Link
              href="/request-payment"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-text-strong transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to Form</span>
            </Link>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5 pt-1 space-y-3">
          <form onSubmit={handleTrackSubmit} className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={trackCodeInput}
                onChange={(e) => setTrackCodeInput(e.target.value.toUpperCase())}
                placeholder="PR-20261124-XXXX"
                disabled={isTracking}
                className="font-mono text-xs uppercase h-8.5 bg-background"
                autoFocus
              />
              <Button
                type="submit"
                disabled={isTracking}
                className="h-8.5 px-3.5 text-xs font-semibold gap-1.5 shrink-0 cursor-pointer"
              >
                {isTracking ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Search className="size-3.5" />
                )}
                <span>Track</span>
              </Button>
            </div>

            {trackError && (
              <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="size-4 shrink-0" />
                <span>{trackError}</span>
              </div>
            )}

            {trackingResult && (
              <div className="border border-border rounded-xl p-3 bg-background/50 space-y-2.5 text-xs animate-in fade-in">
                <div className="flex items-center justify-between pb-1.5 border-b border-border/50">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                      Tracking Reference
                    </span>
                    <span className="font-mono font-bold text-xs text-text-strong">
                      {trackingResult.trackingCode}
                    </span>
                  </div>
                  <div>{getStatusBadge(trackingResult.status)}</div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground text-[10px] block">Beneficiary</span>
                    <span className="font-semibold text-text-strong">{trackingResult.payeeName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px] block">Amount</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      ৳{Number(trackingResult.amount).toLocaleString()} {trackingResult.currency}
                    </span>
                  </div>
                </div>

                <div className="text-xs pt-0.5">
                  <span className="text-muted-foreground text-[10px] block">Bank & Branch</span>
                  <span className="font-medium text-text-strong">
                    {trackingResult.bankName} ({trackingResult.branchName})
                  </span>
                </div>

                <div className="text-xs pt-0.5">
                  <span className="text-muted-foreground text-[10px] block">Purpose</span>
                  <span className="text-text-strong">{trackingResult.purpose}</span>
                </div>

                <div className="pt-2 border-t border-border/50 text-[10px] text-muted-foreground flex justify-between">
                  <span>
                    Submitted: {format(new Date(trackingResult.createdAt), "dd MMM yyyy, hh:mm a")}
                  </span>
                  {trackingResult.exportedAt && (
                    <span className="text-purple-600 dark:text-purple-400 font-medium">
                      Exported: {format(new Date(trackingResult.exportedAt), "dd MMM yyyy")}
                    </span>
                  )}
                </div>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
