import { sql, type SQLWrapper } from "drizzle-orm";
import { z } from "zod";

const cursorFields = z.tuple([z.iso.datetime(), z.uuid()]);

function parseCursor(value: string) {
  try {
    return cursorFields.safeParse(JSON.parse(Buffer.from(value, "base64url").toString())).data;
  } catch {
    return undefined;
  }
}

export const pageCursor = z.string().max(160).regex(/^[A-Za-z0-9_-]+$/)
  .refine((value) => Boolean(parseCursor(value)), "Pass the nextCursor returned by a previous page")
  .optional();

export function beforePage(cursor: string | undefined, createdAt: SQLWrapper, id: SQLWrapper) {
  const point = cursor ? parseCursor(cursor) : undefined;
  if (point) {
    return sql`(${createdAt}, ${id}) < (${point[0]}::timestamptz, ${point[1]}::uuid)`;
  }
}

// Preserve PostgreSQL's microseconds when computing the next page boundary.
export function pageTimestamp(createdAt: SQLWrapper) {
  return sql<string>`to_char(${createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
}

export function finishPage<T extends { id: string; cursorTimestamp: string }>(rows: T[], limit: number) {
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    items: page.map(({ cursorTimestamp: _cursorTimestamp, ...row }) => row),
    nextCursor: rows.length > limit && last
      ? Buffer.from(JSON.stringify([last.cursorTimestamp, last.id])).toString("base64url")
      : null,
  };
}
