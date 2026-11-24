import { db } from "@/db";
import { mcpWriteRequests } from "@/db/schema";
import { and, eq } from "drizzle-orm";

function matchRequest(tokenId: string, key: string) {
  return and(
    eq(mcpWriteRequests.tokenId, tokenId),
    eq(mcpWriteRequests.key, key),
  );
}

export async function reserveWriteRequest(
  tokenId: string,
  key: string,
  requestHash: string,
) {
  const [reservation] = await db
    .insert(mcpWriteRequests)
    .values({ tokenId, key, requestHash })
    .onConflictDoNothing()
    .returning({ key: mcpWriteRequests.key });
  if (reservation) return "reserved" as const;

  const [existing] = await db
    .select()
    .from(mcpWriteRequests)
    .where(matchRequest(tokenId, key))
    .limit(1);
  if (existing?.requestHash !== requestHash) return "conflict" as const;
  if (!existing.completed) return "pending" as const;
  return { status: "completed" as const, receipt: existing.receipt ?? null };
}

export async function completeWriteRequest(
  tokenId: string,
  key: string,
  receipt: Record<string, unknown>,
) {
  await db
    .update(mcpWriteRequests)
    .set({ completed: true, receipt })
    .where(matchRequest(tokenId, key));
}

export async function releaseWriteRequest(tokenId: string, key: string) {
  await db
    .delete(mcpWriteRequests)
    .where(
      and(matchRequest(tokenId, key), eq(mcpWriteRequests.completed, false)),
    );
}

export function compactWriteReceipt(result: unknown) {
  if (!result || typeof result !== "object") return {};
  const data = result as Record<string, unknown>;
  const receipt: Record<string, unknown> = {};

  // Store recovery references only. Workbook contents, banking fields, and audit payloads stay in their source records.
  for (const field of [
    "id",
    "deletedId",
    "trackingCode",
    "status",
    "fileName",
    "count",
  ]) {
    if (typeof data[field] === "string" || typeof data[field] === "number")
      receipt[field] = data[field];
  }
  for (const field of ["exportedIds", "skippedIds"]) {
    if (Array.isArray(data[field]))
      receipt[field] = data[field]
        .filter((id) => typeof id === "string")
        .slice(0, 100);
  }
  for (const field of [
    "invoice",
    "client",
    "vendor",
    "request",
    "debitAccount",
    "defaultAccount",
    "paymentAccount",
    "deleted",
  ]) {
    const record = data[field];
    if (!record || typeof record !== "object") continue;
    const entity = record as Record<string, unknown>;
    if (typeof entity.id === "string") {
      receipt[field] = {
        id: entity.id,
        ...(typeof entity.invoice_number === "string"
          ? { invoice_number: entity.invoice_number }
          : {}),
        ...(typeof entity.trackingCode === "string"
          ? { trackingCode: entity.trackingCode }
          : {}),
      };
    }
  }
  return receipt;
}
