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
  return existing.completed ? ("completed" as const) : ("pending" as const);
}

export async function completeWriteRequest(tokenId: string, key: string) {
  await db
    .update(mcpWriteRequests)
    .set({ completed: true })
    .where(matchRequest(tokenId, key));
}
