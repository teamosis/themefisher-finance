import { db } from "@/db";
import { activityLogs } from "@/db/schema";
import type {
  ActivityAction,
  ActivityDomain,
  ActivityLog,
  ActivityLogDetails,
} from "@/types";
import { headers } from "next/headers";

interface CreateActivityLogInput {
  domain: ActivityDomain;
  action: ActivityAction;
  entityType?: string;
  entityId?: string;
  title: string;
  details?: ActivityLogDetails;
  status?: "success" | "failed" | "warning";
}

/**
 * Write an audit event from trusted server code.
 */
export async function logActivity(
  input: CreateActivityLogInput,
): Promise<ActivityLog> {
  let ipAddress: string | null = null;
  let userAgent: string | null = null;

  try {
    const headerList = await headers();
    const forwarded = headerList.get("x-forwarded-for");
    ipAddress = forwarded
      ? forwarded.split(",")[0].trim()
      : headerList.get("x-real-ip") || null;
    userAgent = headerList.get("user-agent") || null;
  } catch {
    // Graceful fallback if headers cannot be read in some environments
  }

  const [created] = await db
    .insert(activityLogs)
    .values({
      domain: input.domain,
      action: input.action,
      entityType: input.entityType || null,
      entityId: input.entityId || null,
      title: input.title,
      details: input.details || null,
      status: input.status || "success",
      ipAddress,
      userAgent,
    })
    .returning();

  return created as ActivityLog;
}
