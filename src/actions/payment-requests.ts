"use server";

import { db } from "@/db";
import { paymentRequests } from "@/db/schema";
import { requireBrowserSession } from "@/lib/browser-session";
import {
  approvePaymentRequest as approveRequest,
  exportApprovedPaymentRequests,
  rejectPaymentRequest as rejectRequest,
  submitPaymentRequest as submitRequest,
} from "@/lib/payment-request-operations";
import type {
  PaymentRequest,
  PaymentRequestFormData,
  PaymentRequestStatus,
} from "@/types";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

export async function submitPaymentRequest(formData: PaymentRequestFormData) {
  return submitRequest(formData);
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
    conditions.length > 0 ? await query.where(and(...conditions)) : await query;

  return rows as unknown as PaymentRequest[];
}

/**
 * Public action: Check status by tracking code.
 */
export async function getPaymentRequestByTrackingCode(trackingCode: string) {
  if (typeof trackingCode !== "string") return null;
  const code = trackingCode.trim().toUpperCase();
  // Keep previously issued tracking codes usable.
  if (!/^PR-\d{8}-(?:[A-Z0-9]{1,4}|[A-F0-9]{32})$/.test(code)) return null;

  const [row] = await db
    .select({
      trackingCode: paymentRequests.trackingCode,
      status: paymentRequests.status,
      createdAt: paymentRequests.createdAt,
      exportedAt: paymentRequests.exportedAt,
    })
    .from(paymentRequests)
    .where(eq(paymentRequests.trackingCode, code))
    .limit(1);

  return row ?? null;
}

export async function approvePaymentRequest(id: string, options?: { saveAsVendor?: boolean }) {
  await requireBrowserSession();
  return await approveRequest(id, options) as unknown as PaymentRequest;
}

export async function rejectPaymentRequest(id: string, reason: string) {
  await requireBrowserSession();
  return await rejectRequest(id, reason) as unknown as PaymentRequest;
}

export async function exportPaymentRequestsToScb(requestIds: string[], debitAccountId?: string) {
  await requireBrowserSession();
  return exportApprovedPaymentRequests(requestIds, debitAccountId);
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
      totalPendingAmount: sql<string>`coalesce(sum(${paymentRequests.amount}) filter (
        where ${paymentRequests.status} in ('pending', 'verified', 'approved')
          and ${paymentRequests.amount} > 0 and ${paymentRequests.amount} < 1000000000000
      ), 0)`,
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
