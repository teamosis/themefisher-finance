"use server";

import { db } from "@/db";
import { eq } from "drizzle-orm";
import { vendors } from "@/db/schema";
import type { Vendor } from "@/types";

export async function getVendors(): Promise<Vendor[]> {
  const data = await db.select().from(vendors);
  return data as unknown as Vendor[];
}

export async function createVendor(data: Partial<Vendor>) {
  const [result] = await db.insert(vendors).values(data as any).returning();
  return result;
}

export async function updateVendor(id: string, data: Partial<Vendor>) {
  const [result] = await db
    .update(vendors)
    .set({ ...data, createdAt: undefined } as any)
    .where(eq(vendors.id, id))
    .returning();
  return result;
}

export async function deleteVendor(id: string) {
  await db.delete(vendors).where(eq(vendors.id, id));
}
