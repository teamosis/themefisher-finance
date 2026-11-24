import { db } from "@/db";
import { bankBranches, paymentRequests, vendors } from "@/db/schema";
import type { PaymentRequestVerification } from "@/types";
import { subDays } from "date-fns";
import { and, asc, desc, eq, gte, inArray, ne } from "drizzle-orm";

const actionableStatuses = ["pending", "verified"];

export function actionableRequest(id: string) {
  return and(
    eq(paymentRequests.id, id),
    inArray(paymentRequests.status, actionableStatuses),
  );
}

export async function inspectPaymentRequest({
  id,
  accountNumber,
  bankName,
  branchName,
  routingNumber,
}: Pick<
  typeof paymentRequests.$inferSelect,
  "accountNumber" | "bankName" | "branchName" | "routingNumber"
> & { id?: string }): Promise<{
  verification: PaymentRequestVerification;
  status: "pending" | "verified";
}> {
  const [[branch], duplicates, [vendor]] = await Promise.all([
    db
      .select({
        bank: bankBranches.bank_name,
        branch: bankBranches.branch_name,
      })
      .from(bankBranches)
      .where(eq(bankBranches.routing_number, routingNumber))
      .limit(1),
    db
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
          eq(paymentRequests.routingNumber, routingNumber),
          gte(paymentRequests.createdAt, subDays(new Date(), 30)),
          inArray(paymentRequests.status, [
            ...actionableStatuses,
            "approved",
            "exported",
          ]),
          id ? ne(paymentRequests.id, id) : undefined,
        ),
      )
      .orderBy(desc(paymentRequests.createdAt), desc(paymentRequests.id))
      .limit(25),
    db
      .select({ id: vendors.id, name: vendors.receiver_name })
      .from(vendors)
      .where(
        and(
          eq(vendors.account_number, accountNumber),
          eq(vendors.routing_number, routingNumber),
        ),
      )
      .orderBy(asc(vendors.createdAt), asc(vendors.id))
      .limit(1),
  ]);

  const normalized = (value: string) =>
    value.trim().replace(/\s+/g, " ").toLowerCase();
  const routingValid = Boolean(branch);
  const bankMatch = Boolean(
    branch && normalized(branch.bank) === normalized(bankName),
  );
  const branchMatch = Boolean(
    branch && normalized(branch.branch) === normalized(branchName),
  );
  const duplicateDetected = duplicates.length > 0;
  const notes = [
    branch
      ? `Routing number ${routingNumber} belongs to ${branch.bank} (${branch.branch}).`
      : `Routing number ${routingNumber} was not found in the BEFTN directory.`,
  ];

  if (branch && !(bankMatch && branchMatch))
    notes.push(
      "The submitted bank or branch differs from the routing directory.",
    );
  if (duplicateDetected)
    notes.push(
      "Other claims exist for this account and routing number in the last 30 days.",
    );
  if (vendor) notes.push(`Matched registered beneficiary: ${vendor.name}.`);

  return {
    verification: {
      routingValid,
      bankMatch,
      branchMatch,
      duplicateDetected,
      duplicateRequests: duplicates.map((duplicate) => ({
        ...duplicate,
        createdAt: duplicate.createdAt.toISOString(),
      })),
      matchedVendorId: vendor?.id,
      matchedVendorName: vendor?.name,
      verifiedAt: new Date().toISOString(),
      verifiedBy: "system",
      notes,
    },
    status:
      bankMatch && branchMatch && !duplicateDetected ? "verified" : "pending",
  };
}

export async function verifyPaymentRequest(id: string, notes?: string) {
  const [request] = await db
    .select()
    .from(paymentRequests)
    .where(actionableRequest(id))
    .limit(1);
  if (!request)
    throw new Error("Only requests awaiting review can be verified.");

  const { verification, status } = await inspectPaymentRequest(request);
  verification.verifiedBy = "agent";
  if (notes) verification.notes?.push(`Agent note: ${notes}`);

  const [updated] = await db
    .update(paymentRequests)
    .set({
      status,
      verificationDetails: verification,
      vendorId: verification.matchedVendorId ?? null,
      reviewNotes: notes ?? request.reviewNotes,
      updatedAt: new Date(),
    })
    .where(
      and(
        actionableRequest(id),
        eq(paymentRequests.updatedAt, request.updatedAt),
      ),
    )
    .returning();

  if (!updated)
    throw new Error("This payment request changed during verification.");
  return {
    updated,
    verification,
    status,
  };
}
