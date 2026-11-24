import config from "@/config/config.json";
import { db } from "@/db";
import { mcpAccessTokens, mcpLimits, mcpRuns } from "@/db/schema";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";

export class McpAuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401,
  ) {
    super(message);
    this.name = "McpAuthError";
  }
}

export function hashMcpToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateMcpToken(): string {
  return "tff_" + randomBytes(32).toString("base64url");
}

export function getMcpOrigin(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return new URL(process.env.NEXT_PUBLIC_APP_URL).origin;
  }
  return process.env.NODE_ENV === "production" ? new URL(config.site.base_url).origin : "http://localhost:3000";
}

export interface McpTokenRecord {
  id: string;
  name: string;
  prefix: string;
  readOnly: boolean;
  allowedScopes: string[];
  expiresAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
}

export class McpTokenService {
  /**
   * Verify bearer token from HTTP request header
   */
  async verify(req: Request): Promise<McpTokenRecord> {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new McpAuthError(
        "Bearer token required in Authorization header",
        401,
      );
    }

    const tokenMatch = authHeader.match(/^Bearer\s+(tff_[A-Za-z0-9_-]{43})$/);
    if (!tokenMatch) {
      throw new McpAuthError(
        "Invalid token format (expected 'Bearer tff_...')",
        401,
      );
    }

    const token = tokenMatch[1];
    const tokenHash = hashMcpToken(token);

    const [tokenRecord] = await db
      .select()
      .from(mcpAccessTokens)
      .where(
        and(
          eq(mcpAccessTokens.tokenHash, tokenHash),
          isNull(mcpAccessTokens.revokedAt),
          gte(mcpAccessTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!tokenRecord) {
      throw new McpAuthError(
        "Invalid, revoked, or expired MCP bearer token",
        401,
      );
    }

    // Rate limiting: 120 requests per fixed minute
    const now = Date.now();
    const windowStart = new Date(Math.floor(now / 60000) * 60000);
    const limitId = `${tokenRecord.id}:${windowStart.getTime()}`;

    try {
      const [limitRecord] = await db
        .insert(mcpLimits)
        .values({
          id: limitId,
          tokenId: tokenRecord.id,
          count: 1,
          window: windowStart,
        })
        .onConflictDoUpdate({
          target: mcpLimits.id,
          set: { count: sql`${mcpLimits.count} + 1` },
        })
        .returning({ count: mcpLimits.count });

      if (!limitRecord) throw new Error("Rate counter returned no row");
      if (limitRecord.count > 120) {
        throw new McpAuthError(
          "Rate limit exceeded (max 120 requests/minute)",
          429,
        );
      }
    } catch (err) {
      if (err instanceof McpAuthError) throw err;
      throw new McpAuthError(
        "Request rate control is temporarily unavailable",
        503,
      );
    }

    // Update lastUsedAt if not updated in the last 60 seconds
    const lastUsed = tokenRecord.lastUsedAt?.getTime() ?? 0;
    if (now - lastUsed > 60000) {
      await db
        .update(mcpAccessTokens)
        .set({ lastUsedAt: new Date() })
        .where(eq(mcpAccessTokens.id, tokenRecord.id));
    }

    return {
      id: tokenRecord.id,
      name: tokenRecord.name,
      prefix: tokenRecord.prefix,
      readOnly: tokenRecord.readOnly,
      allowedScopes: tokenRecord.allowedScopes,
      expiresAt: tokenRecord.expiresAt,
      revokedAt: tokenRecord.revokedAt,
      lastUsedAt: tokenRecord.lastUsedAt,
      createdAt: tokenRecord.createdAt,
    };
  }

  /**
   * Create a new dedicated agent token. Returns plaintext token ONLY once.
   */
  async createToken(input: {
    name: string;
    readOnly?: boolean;
    allowedScopes?: string[];
    expiresInDays?: number; // 7, 30, 90, 365, or 0 for never
  }): Promise<{ token: string; id: string; prefix: string; name: string }> {
    const rawToken = generateMcpToken();
    const tokenHash = hashMcpToken(rawToken);
    const prefix = rawToken.slice(0, 10);

    const days = input.expiresInDays ?? 90;
    const expiresAt =
      days === 0
        ? new Date(Date.now() + 100 * 365 * 86400000) // ~100 years for never
        : new Date(Date.now() + days * 86400000);

    const [created] = await db
      .insert(mcpAccessTokens)
      .values({
        name: input.name.trim(),
        tokenHash,
        prefix,
        readOnly: Boolean(input.readOnly),
        allowedScopes: input.allowedScopes ?? [],
        expiresAt,
      })
      .returning();

    return {
      id: created.id,
      token: rawToken,
      prefix: created.prefix,
      name: created.name,
    };
  }

  /**
   * Revoke an active token
   */
  async revokeToken(id: string): Promise<boolean> {
    const result = await db
      .update(mcpAccessTokens)
      .set({ revokedAt: new Date() })
      .where(eq(mcpAccessTokens.id, id))
      .returning();
    return result.length > 0;
  }

  /**
   * Permanently delete a token and related limit records
   */
  async deleteToken(id: string): Promise<boolean> {
    await db.delete(mcpLimits).where(eq(mcpLimits.tokenId, id));
    const result = await db
      .delete(mcpAccessTokens)
      .where(eq(mcpAccessTokens.id, id))
      .returning();
    return result.length > 0;
  }

  /**
   * Rotate a token (creates a replacement token, revokes old one)
   */
  async rotateToken(
    id: string,
  ): Promise<{ token: string; id: string; prefix: string; name: string }> {
    const token = generateMcpToken();
    const tokenHash = hashMcpToken(token);
    const prefix = token.slice(0, 10);
    const result = await db.execute(sql`
      WITH revoked AS (
        UPDATE ${mcpAccessTokens}
        SET revoked_at = now()
        WHERE id = ${id} AND revoked_at IS NULL AND expires_at > now()
        RETURNING name, read_only, allowed_scopes, expires_at
      )
      INSERT INTO ${mcpAccessTokens} (name, token_hash, prefix, read_only, allowed_scopes, expires_at)
      SELECT name || ' (Rotated)', ${tokenHash}, ${prefix}, read_only, allowed_scopes, expires_at
      FROM revoked
      RETURNING id, name
    `);
    const replacement = result.rows[0];
    if (!replacement) throw new Error("Active token not found");
    return {
      token,
      id: String(replacement.id),
      prefix,
      name: String(replacement.name),
    };
  }

  /**
   * List all tokens for admin view
   */
  async listTokens() {
    return db
      .select({
        id: mcpAccessTokens.id,
        name: mcpAccessTokens.name,
        prefix: mcpAccessTokens.prefix,
        readOnly: mcpAccessTokens.readOnly,
        allowedScopes: mcpAccessTokens.allowedScopes,
        expiresAt: mcpAccessTokens.expiresAt,
        revokedAt: mcpAccessTokens.revokedAt,
        lastUsedAt: mcpAccessTokens.lastUsedAt,
        createdAt: mcpAccessTokens.createdAt,
      })
      .from(mcpAccessTokens)
      .orderBy(desc(mcpAccessTokens.createdAt));
  }

  /**
   * Record MCP tool execution run for audit log & idempotency
   */
  async recordRun(data: {
    tokenId?: string;
    toolName: string;
    requestId?: string;
    requestHash?: string;
    status: "completed" | "failed" | "running";
    input?: unknown;
    result?: unknown;
    error?: string;
    durationMs?: number;
  }) {
    try {
      const [run] = await db
        .insert(mcpRuns)
        .values({
          tokenId: data.tokenId,
          toolName: data.toolName,
          requestId: data.requestId,
          requestHash: data.requestHash,
          status: data.status,
          input: data.input as any,
          result: data.result as any,
          error: data.error,
          durationMs: data.durationMs,
        })
        .returning();
      return run;
    } catch (err) {
      console.error("Failed to record MCP run:", err);
      return null;
    }
  }

  /**
   * Get recent runs for audit view
   */
  async getRecentRuns(limit = 50) {
    return db
      .select()
      .from(mcpRuns)
      .orderBy(desc(mcpRuns.createdAt))
      .limit(limit);
  }
}

export const mcpTokenService = new McpTokenService();
