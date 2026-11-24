"use server";

import { db } from "@/db";
import {
  activityLogs,
  bankBranches,
  debitAccounts,
  paymentRequests,
  vendors,
} from "@/db/schema";
import { requireBrowserSession } from "@/lib/browser-session";
import type {
  ActivityExcelItem,
  PaymentRequest,
  PaymentRequestFormData,
  PaymentRequestStatus,
  PaymentRequestVerification,
} from "@/types";
import { format, subDays } from "date-fns";
import { and, desc, eq, gte, ilike, inArray, or, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { logActivity, logExcelExport, logSystemActivity } from "./activity-logs";

const submitPaymentRequestSchema = z.object({
  payeeName: z.string().trim().min(2, "Payee name must be at least 2 characters"),
  payeeEmail: z
    .string()
    .trim()
    .email("Invalid email address")
    .optional()
    .or(z.literal("")),
  payeePhone: z.string().trim().optional().or(z.literal("")),
  bankName: z.string().trim().min(1, "Bank name is required"),
  branchName: z.string().trim().min(1, "Branch name is required"),
  routingNumber: z
    .string()
    .trim()
    .regex(/^\d{9}$/, "Routing number must be exactly 9 digits"),
  accountNumber: z.string().trim().min(4, "Account number must be at least 4 digits"),
  confirmAccountNumber: z.string().trim().optional(),
  amount: z
    .string()
    .trim()
    .refine((val) => {
      const num = Number(val);
      return !isNaN(num) && num > 0;
    }, "Amount must be a positive number"),
  purpose: z.string().trim().min(3, "Purpose must be at least 3 characters"),
  website_hp: z.string().optional(), // Honeypot field
});

function generateTrackingCode(): string {
  const dateStr = format(new Date(), "yyyyMMdd");
  const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PR-${dateStr}-${randomChars}`;
}

/**
 * Runs automated validation checks against bank branches and existing records.
 */
async function runAutomatedVerification(
  payeeName: string,
  accountNumber: string,
  bankName: string,
  branchName: string,
  routingNumber: string,
  amount: string,
): Promise<{
  verification: PaymentRequestVerification;
  recommendedStatus: PaymentRequestStatus;
}> {
  const notes: string[] = [];

  // 1. Verify routing number against BEFTN branches database
  const matchingBranch = await db
    .select()
    .from(bankBranches)
    .where(eq(bankBranches.routing_number, routingNumber))
    .limit(1);

  let routingValid = false;
  let bankMatch = false;
  let branchMatch = false;

  if (matchingBranch.length > 0) {
    const branch = matchingBranch[0];
    routingValid = true;
    const normDbBank = branch.bank_name.toLowerCase().trim();
    const normInputBank = bankName.toLowerCase().trim();
    bankMatch =
      normDbBank.includes(normInputBank) || normInputBank.includes(normDbBank);

    const normDbBranch = branch.branch_name.toLowerCase().trim();
    const normInputBranch = branchName.toLowerCase().trim();
    branchMatch =
      normDbBranch.includes(normInputBranch) ||
      normInputBranch.includes(normDbBranch);

    notes.push(
      `Routing number ${routingNumber} verified for ${branch.bank_name} (${branch.branch_name} Branch).`,
    );
  } else {
    notes.push(
      `Warning: Routing number ${routingNumber} was not found in the Bangladesh Bank BEFTN directory.`,
    );
  }

  // 2. Duplicate detection (within last 30 days)
  const thirtyDaysAgo = subDays(new Date(), 30);
  const potentialDuplicates = await db
    .select({
      id: paymentRequests.id,
      trackingCode: paymentRequests.trackingCode,
      amount: paymentRequests.amount,
      createdAt: paymentRequests.createdAt,
      status: paymentRequests.status,
    })
    .from(paymentRequests)
    .where(
      and(
        eq(paymentRequests.accountNumber, accountNumber),
        gte(paymentRequests.createdAt, thirtyDaysAgo),
        inArray(paymentRequests.status, ["pending", "verified", "approved", "exported"]),
      ),
    );

  const duplicateDetected = potentialDuplicates.length > 0;
  if (duplicateDetected) {
    notes.push(
      `Notice: Found ${potentialDuplicates.length} other request(s) for account ${accountNumber} in the last 30 days.`,
    );
  }

  // 3. Match against existing vendors/beneficiaries
  const existingVendor = await db
    .select({
      id: vendors.id,
      receiver_name: vendors.receiver_name,
      account_number: vendors.account_number,
    })
    .from(vendors)
    .where(
      or(
        eq(vendors.account_number, accountNumber),
        ilike(vendors.receiver_name, `%${payeeName}%`),
      ),
    )
    .limit(1);

  let matchedVendorId: string | undefined;
  let matchedVendorName: string | undefined;

  if (existingVendor.length > 0) {
    matchedVendorId = existingVendor[0].id;
    matchedVendorName = existingVendor[0].receiver_name;
    notes.push(`Matched existing registered beneficiary: ${matchedVendorName}.`);
  }

  const verification: PaymentRequestVerification = {
    routingValid,
    bankMatch,
    branchMatch,
    duplicateDetected,
    duplicateRequests: potentialDuplicates.map((d) => ({
      id: d.id,
      trackingCode: d.trackingCode,
      amount: d.amount,
      createdAt: d.createdAt.toISOString(),
      status: d.status,
    })),
    matchedVendorId,
    matchedVendorName,
    verifiedAt: new Date().toISOString(),
    verifiedBy: "system",
    notes,
  };

  // If routing is valid and no duplicates detected, we mark as "verified"
  const recommendedStatus: PaymentRequestStatus =
    routingValid && !duplicateDetected ? "verified" : "pending";

  return { verification, recommendedStatus };
}

/**
 * Public action: Submit a payment request.
 */
export async function submitPaymentRequest(formData: PaymentRequestFormData) {
  // Honeypot check
  if (formData.website_hp && formData.website_hp.trim().length > 0) {
    return { success: false, error: "Invalid submission detected." };
  }

  // Account number confirmation check
  if (
    formData.confirmAccountNumber &&
    formData.accountNumber.trim() !== formData.confirmAccountNumber.trim()
  ) {
    return {
      success: false,
      error: "Account numbers do not match. Please verify your entry.",
    };
  }

  const parsed = submitPaymentRequestSchema.safeParse(formData);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message || "Invalid input data";
    return { success: false, error: errorMsg };
  }

  const data = parsed.data;
  const trackingCode = generateTrackingCode();

  // Run automated verification
  const { verification, recommendedStatus } = await runAutomatedVerification(
    data.payeeName,
    data.accountNumber,
    data.bankName,
    data.branchName,
    data.routingNumber,
    data.amount,
  );

  let ipAddress: string | null = null;
  try {
    const headerList = await headers();
    const forwarded = headerList.get("x-forwarded-for");
    ipAddress = forwarded
      ? forwarded.split(",")[0].trim()
      : headerList.get("x-real-ip") || null;
  } catch {
    // Ignore header read issues
  }

  const [created] = await db
    .insert(paymentRequests)
    .values({
      trackingCode,
      payeeName: data.payeeName,
      payeeEmail: data.payeeEmail || null,
      payeePhone: data.payeePhone || null,
      bankName: data.bankName,
      branchName: data.branchName,
      routingNumber: data.routingNumber,
      accountNumber: data.accountNumber,
      amount: data.amount,
      currency: "BDT",
      purpose: data.purpose,
      status: recommendedStatus,
      verificationDetails: verification as any,
      vendorId: verification.matchedVendorId || null,
      ipAddress,
    })
    .returning();

  if (created) {
    await logSystemActivity({
      domain: "scb_tools",
      action: "payment_request_submit",
      entityType: "payment_request",
      entityId: created.id,
      title: `New payment request received: ${created.payeeName} (৳${Number(created.amount).toLocaleString()})`,
      details: {
        reason: created.purpose,
        totalAmount: created.amount,
        extra: {
          trackingCode: created.trackingCode,
          bankName: created.bankName,
          branchName: created.branchName,
          routingNumber: created.routingNumber,
          accountNumber: created.accountNumber,
          initialStatus: created.status,
          verification: verification,
        },
      },
    }).catch(() => {});
  }

  return {
    success: true,
    trackingCode: created.trackingCode,
    id: created.id,
    status: created.status,
  };
}

/**
 * Protected action: Retrieve payment requests with filters.
 */
export async function getPaymentRequests(filter?: {
  status?: PaymentRequestStatus | "all";
  search?: string;
}): Promise<PaymentRequest[]> {
  await requireBrowserSession();

  const conditions = [];

  if (filter?.status && filter.status !== "all") {
    conditions.push(eq(paymentRequests.status, filter.status));
  }

  if (filter?.search && filter.search.trim()) {
    const term = `%${filter.search.trim()}%`;
    conditions.push(
      or(
        ilike(paymentRequests.payeeName, term),
        ilike(paymentRequests.trackingCode, term),
        ilike(paymentRequests.accountNumber, term),
        ilike(paymentRequests.bankName, term),
        ilike(paymentRequests.purpose, term),
      ),
    );
  }

  const query = db
    .select()
    .from(paymentRequests)
    .orderBy(desc(paymentRequests.createdAt));

  const rows =
    conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;

  return rows as unknown as PaymentRequest[];
}

/**
 * Protected action: Get full details of a specific payment request.
 */
export async function getPaymentRequestById(id: string): Promise<PaymentRequest | null> {
  await requireBrowserSession();
  const rows = await db
    .select()
    .from(paymentRequests)
    .where(eq(paymentRequests.id, id))
    .limit(1);

  return rows.length > 0 ? (rows[0] as unknown as PaymentRequest) : null;
}

/**
 * Public action: Check status by tracking code.
 */
export async function getPaymentRequestByTrackingCode(trackingCode: string) {
  const rows = await db
    .select({
      trackingCode: paymentRequests.trackingCode,
      payeeName: paymentRequests.payeeName,
      bankName: paymentRequests.bankName,
      branchName: paymentRequests.branchName,
      amount: paymentRequests.amount,
      currency: paymentRequests.currency,
      purpose: paymentRequests.purpose,
      status: paymentRequests.status,
      createdAt: paymentRequests.createdAt,
      exportedAt: paymentRequests.exportedAt,
    })
    .from(paymentRequests)
    .where(eq(paymentRequests.trackingCode, trackingCode.trim().toUpperCase()))
    .limit(1);

  if (rows.length === 0) return null;
  return rows[0];
}

/**
 * Re-runs verification checks or records agent audit notes on a payment request.
 */
export async function verifyPaymentRequest(
  id: string,
  notes?: string,
  verifiedBy: "system" | "agent" = "agent",
) {
  await requireBrowserSession();

  const rows = await db
    .select()
    .from(paymentRequests)
    .where(eq(paymentRequests.id, id))
    .limit(1);

  if (rows.length === 0) {
    throw new Error("Payment request not found");
  }

  const req = rows[0];
  const { verification } = await runAutomatedVerification(
    req.payeeName,
    req.accountNumber,
    req.bankName,
    req.branchName,
    req.routingNumber,
    req.amount,
  );

  verification.verifiedBy = verifiedBy;
  if (notes) {
    verification.notes = [...(verification.notes || []), notes];
  }

  const [updated] = await db
    .update(paymentRequests)
    .set({
      status: "verified",
      verificationDetails: verification as any,
      reviewNotes: notes || req.reviewNotes,
      updatedAt: new Date(),
    })
    .where(eq(paymentRequests.id, id))
    .returning();

  await logActivity({
    domain: "scb_tools",
    action: "payment_request_verify",
    entityType: "payment_request",
    entityId: id,
    title: `Payment request verified: ${req.payeeName} (${req.trackingCode})`,
    details: {
      reason: notes,
      extra: { verification },
    },
  }).catch(() => {});

  return updated as unknown as PaymentRequest;
}

/**
 * Protected action: Approve payment request.
 * Optionally creates/links a vendor record in `vendors`.
 */
export async function approvePaymentRequest(
  id: string,
  options?: { saveAsVendor?: boolean },
) {
  await requireBrowserSession();

  const rows = await db
    .select()
    .from(paymentRequests)
    .where(eq(paymentRequests.id, id))
    .limit(1);

  if (rows.length === 0) {
    throw new Error("Payment request not found");
  }

  const req = rows[0];

  let vendorId = req.vendorId;

  // If user requested to save as vendor, check if vendor exists or insert
  if (options?.saveAsVendor && !vendorId) {
    const existing = await db
      .select({ id: vendors.id })
      .from(vendors)
      .where(eq(vendors.account_number, req.accountNumber))
      .limit(1);

    if (existing.length > 0) {
      vendorId = existing[0].id;
    } else {
      const [newVendor] = await db
        .insert(vendors)
        .values({
          receiver_name: req.payeeName,
          account_number: req.accountNumber,
          bank_name: req.bankName,
          branch_name: req.branchName,
          routingNumber: req.routingNumber,
          is_employee: false,
          salary: "0",
        } as any)
        .returning();

      if (newVendor) {
        vendorId = newVendor.id;
      }
    }
  }

  const [updated] = await db
    .update(paymentRequests)
    .set({
      status: "approved",
      approvedAt: new Date(),
      vendorId: vendorId || req.vendorId,
      updatedAt: new Date(),
    })
    .where(eq(paymentRequests.id, id))
    .returning();

  await logActivity({
    domain: "scb_tools",
    action: "payment_request_approve",
    entityType: "payment_request",
    entityId: id,
    title: `Payment request approved: ${req.payeeName} (৳${Number(req.amount).toLocaleString()})`,
    details: {
      totalAmount: req.amount,
      reason: req.purpose,
      extra: {
        trackingCode: req.trackingCode,
        vendorId,
      },
    },
  }).catch(() => {});

  return updated as unknown as PaymentRequest;
}

/**
 * Protected action: Reject payment request.
 */
export async function rejectPaymentRequest(id: string, reason: string) {
  await requireBrowserSession();

  const rows = await db
    .select()
    .from(paymentRequests)
    .where(eq(paymentRequests.id, id))
    .limit(1);

  if (rows.length === 0) {
    throw new Error("Payment request not found");
  }

  const req = rows[0];

  const [updated] = await db
    .update(paymentRequests)
    .set({
      status: "rejected",
      rejectionReason: reason.trim(),
      updatedAt: new Date(),
    })
    .where(eq(paymentRequests.id, id))
    .returning();

  await logActivity({
    domain: "scb_tools",
    action: "payment_request_reject",
    entityType: "payment_request",
    entityId: id,
    title: `Payment request rejected: ${req.payeeName} (${req.trackingCode})`,
    details: {
      reason,
      totalAmount: req.amount,
    },
  }).catch(() => {});

  return updated as unknown as PaymentRequest;
}

/**
 * Protected action: Export approved payment requests to SCB Straight2Bank format.
 * Returns raw rows for SheetJS export, updates status to 'exported', and writes audit log.
 */
export async function exportPaymentRequestsToScb(
  requestIds: string[],
  debitAccountId?: string,
) {
  await requireBrowserSession();

  if (!requestIds || requestIds.length === 0) {
    throw new Error("No payment requests selected for export.");
  }

  // Fetch requests (only approved ones can be exported)
  const requests = await db
    .select()
    .from(paymentRequests)
    .where(
      and(
        inArray(paymentRequests.id, requestIds),
        eq(paymentRequests.status, "approved"),
      ),
    );

  if (requests.length === 0) {
    throw new Error("No approved payment requests found to export.");
  }

  // Fetch active debit account
  let debitAccountNum = "";
  if (debitAccountId) {
    const [acc] = await db
      .select({ account_number: debitAccounts.account_number })
      .from(debitAccounts)
      .where(eq(debitAccounts.id, debitAccountId))
      .limit(1);
    debitAccountNum = acc?.account_number || "";
  }

  if (!debitAccountNum) {
    const [defaultAcc] = await db
      .select({ account_number: debitAccounts.account_number })
      .from(debitAccounts)
      .where(eq(debitAccounts.is_default, true))
      .limit(1);
    debitAccountNum = defaultAcc?.account_number || "";
  }

  if (!debitAccountNum) {
    const [fallbackAcc] = await db
      .select({ account_number: debitAccounts.account_number })
      .from(debitAccounts)
      .limit(1);
    debitAccountNum = fallbackAcc?.account_number || "";
  }

  if (!debitAccountNum) {
    throw new Error(
      "No SCB debit account found. Please configure a debit account in SCB Tools first.",
    );
  }

  const formattedDate = format(new Date(), "dd/MM/yyyy");
  const fileName = `SCB_Payment_Requests_${format(new Date(), "yyyyMMdd_HHmmss")}.xlsx`;

  let totalAmount = 0;
  const scbRows: Record<string, string>[] = [];
  const activityItems: ActivityExcelItem[] = [];

  for (const req of requests) {
    const amountNum = Number(req.amount) || 0;
    totalAmount += amountNum;

    scbRows.push({
      "Customer Reference": req.trackingCode,
      "Beneficiary Name(120)": req.payeeName,
      "Beneficiary Account Number": req.accountNumber,
      "Routing Number": req.routingNumber,
      "Payment Amount": req.amount,
      "Reason(140)": req.purpose,
      "Date(DD/MM/YYYY)": formattedDate,
      "Debit Account Number(Prefix- 00 BDT)": debitAccountNum.trim(),
      "Beneficiary Email ID(Optional)": req.payeeEmail || "",
    });

    activityItems.push({
      beneficiaryName: req.payeeName,
      accountNumber: req.accountNumber,
      bankName: req.bankName,
      branchName: req.branchName,
      routingNumber: req.routingNumber,
      amount: req.amount,
      reason: req.purpose,
      isEmployee: false,
    });
  }

  // Update payment requests to 'exported'
  const exportedIds = requests.map((r) => r.id);
  await db
    .update(paymentRequests)
    .set({
      status: "exported",
      exportedAt: new Date(),
      scbFileName: fileName,
      updatedAt: new Date(),
    })
    .where(inArray(paymentRequests.id, exportedIds));

  // Log activity
  await logExcelExport({
    type: "transfers",
    fileName,
    sheetName: "Payment Requests",
    totalAmount,
    currency: "BDT",
    itemCount: scbRows.length,
    debitAccount: debitAccountNum,
    reason: `SCB Bulk Export for ${scbRows.length} Payment Request(s)`,
    items: activityItems,
  }).catch(() => {});

  return {
    rows: scbRows,
    fileName,
    count: scbRows.length,
    totalAmount,
    exportedIds,
  };
}

/**
 * Returns summary counts for the dashboard badge and tabs.
 */
export async function getPaymentRequestsStats() {
  await requireBrowserSession();

  const [stats] = await db
    .select({
      total: sql<number>`count(*)`,
      pending: sql<number>`count(*) filter (where ${paymentRequests.status} = 'pending')`,
      verified: sql<number>`count(*) filter (where ${paymentRequests.status} = 'verified')`,
      approved: sql<number>`count(*) filter (where ${paymentRequests.status} = 'approved')`,
      rejected: sql<number>`count(*) filter (where ${paymentRequests.status} = 'rejected')`,
      exported: sql<number>`count(*) filter (where ${paymentRequests.status} = 'exported')`,
      totalPendingAmount: sql<number>`coalesce(sum(case when ${paymentRequests.status} in ('pending', 'verified', 'approved') then cast(${paymentRequests.amount} as numeric) else 0 end), 0)`,
    })
    .from(paymentRequests);

  return {
    total: Number(stats?.total || 0),
    pending: Number(stats?.pending || 0),
    verified: Number(stats?.verified || 0),
    approved: Number(stats?.approved || 0),
    rejected: Number(stats?.rejected || 0),
    exported: Number(stats?.exported || 0),
    actionableCount: Number(stats?.pending || 0) + Number(stats?.verified || 0),
    totalPendingAmount: Number(stats?.totalPendingAmount || 0),
  };
}
