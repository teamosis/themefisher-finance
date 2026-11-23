"use server";

import { db } from "@/db";
import { eq, asc } from "drizzle-orm";
import { clients } from "@/db/schema";
import type { Client } from "@/types";

export async function getClients(): Promise<Client[]> {
  const data = await db.select().from(clients).orderBy(asc(clients.name));
  return data as unknown as Client[];
}

export async function createClient(data: Partial<Client>) {
  const [result] = await db.insert(clients).values(data as any).returning();
  return result;
}

export async function updateClient(id: string, data: Partial<Client>) {
  const [result] = await db
    .update(clients)
    .set({ ...data, createdAt: undefined } as any)
    .where(eq(clients.id, id))
    .returning();
  return result;
}

export async function deleteClient(id: string) {
  await db.delete(clients).where(eq(clients.id, id));
}
