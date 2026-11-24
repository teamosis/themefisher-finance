"use server";

import { db } from "@/db";
import { clients } from "@/db/schema";
import { requireBrowserSession } from "@/lib/browser-session";
import type { Client } from "@/types";
import { asc, eq } from "drizzle-orm";

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
  return result;
}

export async function updateClient(id: string, data: Partial<Client>) {
  await requireBrowserSession();
  const [result] = await db
    .update(clients)
    .set({ ...data, createdAt: undefined } as any)
    .where(eq(clients.id, id))
    .returning();
  return result;
}

export async function deleteClient(id: string) {
  await requireBrowserSession();
  await db.delete(clients).where(eq(clients.id, id));
}
