import { db } from "@/db";
import { getScbDebitAccountNumber } from "@/db/debit-accounts";
import { activityLogs, paymentRequests, vendors } from "@/db/schema";
import { logActivity } from "@/lib/activity-log";
import { actionableRequest, inspectPaymentRequest } from "@/lib/payment-request-verification";
import { scbWorkbookRow } from "@/lib/scb-workbook";
import { format } from "date-fns";
import { eq, inArray, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { randomBytes } from "node:crypto";
import { z } from "zod";

const paymentAmountPattern = /^\d{1,12}(?:\.\d{1,2})?$/;
export const paymentRequestFields = z
  .object({
    payeeName: z.string().trim().min(2, "Enter your full name").max(120),
    payeeEmail: z
      .string()
      .trim()
      .max(254)
      .email("Invalid email address")
      .or(z.literal(""))
      .optional(),
    payeePhone: z.string().trim().max(40).optional(),
    bankName: z.string().trim().min(1, "Bank name is required").max(150),
    branchName: z.string().trim().min(1, "Branch name is required").max(150),
    routingNumber: z
      .string()
      .trim()
      .regex(/^\d{9}$/, "Routing number must be exactly 9 digits"),
    accountNumber: z
      .string()
      .trim()
      .regex(/^\d{4,34}$/, "Account number must contain 4 to 34 digits"),
    confirmAccountNumber: z.string().trim().max(34),
    amount: z
      .string()
      .trim()
      .regex(
        paymentAmountPattern,
        "Enter an amount with up to two decimal places",
      )
      .refine((value) => Number(value) > 0, "Amount must be positive"),
    purpose: z
      .string()
      .trim()
      .min(3, "Purpose must be at least 3 characters")
      .max(140),
    website_hp: z.string().optional(),
  });

const submitPaymentRequestSchema = paymentRequestFields.refine((data) => data.accountNumber === data.confirmAccountNumber, {
    message: "Account numbers do not match. Please verify your entry.",
    path: ["confirmAccountNumber"],
  });

function generateTrackingCode(): string {
  return `PR-${format(new Date(), "yyyyMMdd")}-${randomBytes(16).toString("hex").toUpperCase()}`;
}

/**
 * Public action: Submit a payment request.
 */
export async function submitPaymentRequest(formData: unknown) {
  const parsed = submitPaymentRequestSchema.safeParse(formData);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message || "Invalid input data";
    return { success: false, error: errorMsg };
  }

  const data = parsed.data;
  if (data.website_hp?.trim()) {
    return { success: false, error: "Invalid submission detected." };
  }

  const { verification, status } = await inspectPaymentRequest(data);

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
      trackingCode: generateTrackingCode(),
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
      status,
      verificationDetails: verification,
      vendorId: verification.matchedVendorId || null,
      ipAddress,
    })
    .returning();

  if (created) {
    await logActivity({
      domain: "scb_tools",
      action: "payment_request_submit",
      entityType: "payment_request",
      entityId: created.id,
      title: `New payment request received: ${created.payeeName} (৳${Number(created.amount).toLocaleString()})`,
      details: {
        reason: created.purpose,
        totalAmount: created.amount,
        extra: { initialStatus: created.status },
      },
    }).catch(() => {});
  }

  return {
    success: true,
    trackingCode: created.trackingCode,
  };
}

/**
 * Protected action: Approve payment request.
 * Optionally creates/links a vendor record in `vendors`.
 */
export async function approvePaymentRequest(
  id: string,
  options?: { saveAsVendor?: boolean },
) {
  const approvedAt = new Date();
  let updated: typeof paymentRequests.$inferSelect | undefined;

  if (options?.saveAsVendor === true) {
    // Lock the actionable request before saving a vendor, so a conflicting
    // approval or rejection cannot leave behind a vendor from a failed approval.
    const approved = await db.execute<{ id: string }>(sql`
      WITH eligible AS MATERIALIZED (
        SELECT * FROM ${paymentRequests}
        WHERE id = ${id} AND status IN ('pending', 'verified')
        FOR UPDATE
      ), linked AS (
        SELECT eligible.*, (
          SELECT id FROM ${vendors}
          WHERE account_number = eligible.account_number
            AND routing_number = eligible.routing_number
          ORDER BY (id = eligible.vendor_id) DESC NULLS LAST, created_at, id
          LIMIT 1
        ) AS existing_vendor_id
        FROM eligible
      ), new_vendor AS (
        INSERT INTO ${vendors}
          (receiver_name, account_number, bank_name, branch_name, routing_number)
        SELECT payee_name, account_number, bank_name, branch_name, routing_number
        FROM linked WHERE existing_vendor_id IS NULL
        RETURNING id
      )
      UPDATE ${paymentRequests} AS request
      SET status = 'approved', approved_at = ${approvedAt.toISOString()},
          updated_at = ${approvedAt.toISOString()},
          vendor_id = COALESCE(linked.existing_vendor_id, (SELECT id FROM new_vendor))
      FROM linked WHERE request.id = linked.id
      RETURNING request.id
    `);
    if (approved.rows.length) {
      [updated] = await db
        .select()
        .from(paymentRequests)
        .where(eq(paymentRequests.id, id));
    }
  } else {
    [updated] = await db
      .update(paymentRequests)
      .set({ status: "approved", approvedAt, updatedAt: approvedAt })
      .where(actionableRequest(id))
      .returning();
  }

  if (!updated)
    throw new Error("Only requests awaiting review can be approved.");

  await logActivity({
    domain: "scb_tools",
    action: "payment_request_approve",
    entityType: "payment_request",
    entityId: id,
    title: `Payment request approved: ${updated.payeeName} (৳${Number(updated.amount).toLocaleString()})`,
    details: {
      totalAmount: updated.amount,
      reason: updated.purpose,
      extra: {
        trackingCode: updated.trackingCode,
        vendorId: updated.vendorId,
      },
    },
  }).catch(() => {});

  return updated;
}

/**
 * Protected action: Reject payment request.
 */
export async function rejectPaymentRequest(id: string, reason: string) {
  const rejectionReason = z.string().trim().min(1).max(1000).parse(reason);
  const [updated] = await db
    .update(paymentRequests)
    .set({ status: "rejected", rejectionReason, updatedAt: new Date() })
    .where(actionableRequest(id))
    .returning();

  if (!updated)
    throw new Error("Only requests awaiting review can be rejected.");

  await logActivity({
    domain: "scb_tools",
    action: "payment_request_reject",
    entityType: "payment_request",
    entityId: id,
    title: `Payment request rejected: ${updated.payeeName} (${updated.trackingCode})`,
    details: {
      reason: rejectionReason,
      totalAmount: updated.amount,
    },
  }).catch(() => {});

  return updated;
}

/**
 * Protected action: Export approved payment requests to SCB Straight2Bank format.
 * Returns raw rows for SheetJS export, updates status to 'exported', and writes audit log.
 */
export async function exportApprovedPaymentRequests(
  requestIds: string[],
  debitAccountId?: string,
) {
  const ids = [...new Set(z.array(z.uuid()).min(1).parse(requestIds))];
  if (debitAccountId) z.uuid().parse(debitAccountId);
  const debitAccountNum = await getScbDebitAccountNumber(debitAccountId);

  const now = new Date();
  const formattedDate = format(now, "dd/MM/yyyy");
  const fileName = `SCB_Payment_Requests_${format(now, "yyyyMMdd_HHmmss")}_${randomBytes(4).toString("hex")}.xlsx`;
  const result = await db.execute<{
    id: string;
    customerReference: string;
    beneficiaryName: string;
    accountNumber: string;
    routingNumber: string;
    amount: string;
    reason: string;
    email: string;
  }>(sql`
    WITH exported AS (
      UPDATE ${paymentRequests}
      SET status = 'exported', exported_at = ${now.toISOString()},
          updated_at = ${now.toISOString()}, scb_file_name = ${fileName}
      WHERE ${inArray(paymentRequests.id, ids)} AND status = 'approved'
        AND amount > 0 AND amount < 1000000000000 AND amount = round(amount, 2)
      RETURNING id,
        CASE WHEN length(tracking_code) <= 16 THEN tracking_code
             ELSE upper(left(replace(id::text, '-', ''), 16)) END AS "customerReference",
        payee_name AS "beneficiaryName", account_number AS "accountNumber",
        routing_number AS "routingNumber", amount::text AS amount,
        purpose AS reason, coalesce(payee_email, '') AS email,
        bank_name AS "bankName", branch_name AS "branchName"
    ), audit AS (
      INSERT INTO ${activityLogs} (domain, action, entity_type, entity_id, title, details)
      SELECT 'scb_tools', 'excel_export_transfers', 'payment_request_export', ${fileName},
        'Exported SCB payment requests: ' || count(*)::text,
        jsonb_build_object(
          'fileName', ${fileName}::text, 'sheetName', 'Payment Requests', 'currency', 'BDT',
          'totalAmount', sum(amount::numeric), 'itemCount', count(*),
          'debitAccount', ${debitAccountNum}::text, 'paymentDate', ${formattedDate}::text,
          'items', jsonb_agg(to_jsonb(exported) - 'id' ORDER BY id)
        )
      FROM exported HAVING count(*) > 0
    )
    SELECT * FROM exported ORDER BY id
  `);
  const requests = result.rows;
  if (!requests.length) {
    throw new Error("No eligible approved payment requests found to export.");
  }

  const rows = requests.map((request) =>
    scbWorkbookRow(request, formattedDate, debitAccountNum),
  );

  return {
    rows,
    fileName,
    count: rows.length,
    totalAmount:
      requests.reduce(
        (sum, req) => sum + Math.round(Number(req.amount) * 100),
        0,
      ) / 100,
    exportedIds: requests.map(({ id }) => id),
  };
}

