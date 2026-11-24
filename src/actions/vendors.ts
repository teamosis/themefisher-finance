"use server";

import { db } from "@/db";
import { vendors } from "@/db/schema";
import { requireBrowserSession } from "@/lib/browser-session";
import type { Vendor } from "@/types";
import { eq, sql } from "drizzle-orm";
import { logActivity } from "./activity-logs";

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

  if (result) {
    await logActivity({
      domain: "scb_tools",
      action: "vendor_create",
      entityType: "vendor",
      entityId: result.id,
      title: `Added beneficiary: ${result.receiver_name} (${result.bank_name})`,
      details: {
        extra: {
          receiverName: result.receiver_name,
          accountNumber: result.account_number,
          bankName: result.bank_name,
          branchName: result.branch_name,
          routingNumber: result.routing_number,
          isEmployee: result.is_employee,
          salary: result.salary,
        },
      },
    }).catch(() => {});
  }

  return result;
}

export async function updateVendor(id: string, data: Partial<Vendor>) {
  await requireBrowserSession();
  const [result] = await db
    .update(vendors)
    .set({ ...data, createdAt: undefined } as any)
    .where(eq(vendors.id, id))
    .returning();

  if (result) {
    const isArchiving = data.is_hidden === true;
    const isRestoring = data.is_hidden === false;
    const action = isArchiving
      ? "vendor_archive"
      : isRestoring
        ? "vendor_restore"
        : "vendor_update";
    const title = isArchiving
      ? `Archived beneficiary: ${result.receiver_name}`
      : isRestoring
        ? `Restored beneficiary: ${result.receiver_name}`
        : `Updated beneficiary: ${result.receiver_name}`;

    await logActivity({
      domain: "scb_tools",
      action,
      entityType: "vendor",
      entityId: result.id,
      title,
      details: {
        extra: {
          receiverName: result.receiver_name,
          isHidden: result.is_hidden,
          salary: result.salary,
        },
      },
    }).catch(() => {});
  }

  return result;
}

export async function deleteVendor(id: string) {
  await requireBrowserSession();
  await db.delete(vendors).where(eq(vendors.id, id));

  await logActivity({
    domain: "scb_tools",
    action: "vendor_delete",
    entityType: "vendor",
    entityId: id,
    title: `Permanently deleted beneficiary`,
    details: { extra: { id } },
  }).catch(() => {});
}
