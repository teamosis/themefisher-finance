"use server";

import { db } from "@/db";
import { vendors } from "@/db/schema";
import { requireBrowserSession } from "@/lib/browser-session";
import type { Vendor } from "@/types";
import { eq, sql } from "drizzle-orm";

export async function getVendors(): Promise<Vendor[]> {
  await requireBrowserSession();
  const data = await db.select().from(vendors);
  return data as unknown as Vendor[];
}

export async function getPayoutVendors(): Promise<Vendor[]> {
  await requireBrowserSession();
  return (await db
    .select({
      id: vendors.id,
      receiver_name: vendors.receiver_name,
      account_number: vendors.account_number,
      bank_name: vendors.bank_name,
      branch_name: vendors.branch_name,
      routing_number: vendors.routing_number,
      is_employee: vendors.is_employee,
      salary: vendors.salary,
    })
    .from(vendors)
    .where(sql`${vendors.is_hidden} IS NOT TRUE`)) as Vendor[];
}

export async function createVendor(data: Partial<Vendor>) {
  await requireBrowserSession();
  const [result] = await db
    .insert(vendors)
    .values(data as any)
    .returning();
  return result;
}

export async function updateVendor(id: string, data: Partial<Vendor>) {
  await requireBrowserSession();
  const [result] = await db
    .update(vendors)
    .set({ ...data, createdAt: undefined } as any)
    .where(eq(vendors.id, id))
    .returning();
  return result;
}

export async function deleteVendor(id: string) {
  await requireBrowserSession();
  await db.delete(vendors).where(eq(vendors.id, id));
}
