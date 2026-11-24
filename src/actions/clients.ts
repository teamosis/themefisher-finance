"use server";

import { db } from "@/db";
import { clients } from "@/db/schema";
import { requireBrowserSession } from "@/lib/browser-session";
import type { Client } from "@/types";
import { asc, eq } from "drizzle-orm";
import { logActivity } from "./activity-logs";

export async function getClients(): Promise<Client[]> {
  await requireBrowserSession();
  const data = await db.select().from(clients).orderBy(asc(clients.name));
  return data as unknown as Client[];
}

export async function createClient(data: Partial<Client>) {
  await requireBrowserSession();
  const [result] = await db
    .insert(clients)
    .values(data as any)
    .returning();

  if (result) {
    await logActivity({
      domain: "invoice_tools",
      action: "client_create",
      entityType: "client",
      entityId: result.id,
      title: `Created client: ${result.name}`,
      details: {
        extra: {
          name: result.name,
          bankName: result.bank_name,
        },
      },
    }).catch(() => {});
  }

  return result;
}

export async function updateClient(id: string, data: Partial<Client>) {
  await requireBrowserSession();
  const [result] = await db
    .update(clients)
    .set({ ...data, createdAt: undefined } as any)
    .where(eq(clients.id, id))
    .returning();

  if (result) {
    await logActivity({
      domain: "invoice_tools",
      action: "client_update",
      entityType: "client",
      entityId: result.id,
      title: `Updated client: ${result.name}`,
      details: { extra: { id, ...data } },
    }).catch(() => {});
  }

  return result;
}

export async function deleteClient(id: string) {
  await requireBrowserSession();
  await db.delete(clients).where(eq(clients.id, id));

  await logActivity({
    domain: "invoice_tools",
    action: "client_delete",
    entityType: "client",
    entityId: id,
    title: `Deleted client`,
    details: { extra: { id } },
  }).catch(() => {});
}
