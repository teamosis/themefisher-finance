import { db } from "@/db";
import {
  generateMcpToken,
  hashMcpToken,
  mcpTokenService,
} from "@/lib/mcp/token-service";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
  };
  return { db: mockDb };
});

describe("McpTokenService Security & Lifecycle Suite", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Token Generation and Hashing", () => {
    it("generates 47-character token starting with 'tff_' prefix", () => {
      const token1 = generateMcpToken();
      const token2 = generateMcpToken();

      expect(token1.startsWith("tff_")).toBe(true);
      expect(token1).toHaveLength(47); // 'tff_' (4) + 43 base64url chars
      expect(token1).not.toBe(token2);
    });

    it("hashes tokens with SHA-256 into 64-char hex string", () => {
      const token = "tff_" + "a".repeat(43);
      const hash = hashMcpToken(token);

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      expect(hashMcpToken(token)).toBe(hash);
    });
  });

  describe("verify Request", () => {
    const makeReq = (authHeader?: string) => {
      const headers = new Headers();
      if (authHeader) headers.set("authorization", authHeader);
      return new Request("http://localhost:3000/api/mcp", { headers });
    };

    it("throws 401 when Authorization header is missing", async () => {
      const req = makeReq();
      await expect(mcpTokenService.verify(req)).rejects.toMatchObject({
        statusCode: 401,
        message: expect.stringContaining("Bearer token required"),
      });
    });

    it("throws 401 when token format is invalid (not 'Bearer tff_...')", async () => {
      const req = makeReq("Bearer invalid_token_format");
      await expect(mcpTokenService.verify(req)).rejects.toMatchObject({
        statusCode: 401,
        message: expect.stringContaining("Invalid token format"),
      });
    });

    it("throws 401 when token is not found, expired, or revoked in database", async () => {
      const limitMock = vi.fn().mockResolvedValue([]);
      const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      vi.mocked(db.select).mockReturnValue({ from: fromMock } as any);

      const req = makeReq("Bearer tff_" + "a".repeat(43));
      await expect(mcpTokenService.verify(req)).rejects.toMatchObject({
        statusCode: 401,
        message: expect.stringContaining("Invalid, revoked, or expired"),
      });
    });

    it("successfully verifies active unrevoked token and returns token principal", async () => {
      const validToken = "tff_" + "b".repeat(43);
      const tokenRecord = {
        id: "tok_123",
        name: "Antigravity Assistant",
        prefix: validToken.slice(0, 10),
        readOnly: false,
        allowedScopes: ["*"],
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        lastUsedAt: new Date(),
        createdAt: new Date(),
      };

      // 1. Token lookup
      const limitMock1 = vi.fn().mockResolvedValue([tokenRecord]);
      const whereMock1 = vi.fn().mockReturnValue({ limit: limitMock1 });
      const fromMock1 = vi.fn().mockReturnValue({ where: whereMock1 });

      vi.mocked(db.select).mockReturnValueOnce({ from: fromMock1 } as any);

      const returning = vi.fn().mockResolvedValue([{ count: 1 }]);
      const onConflictMock = vi.fn().mockReturnValue({ returning });
      const valuesMock = vi
        .fn()
        .mockReturnValue({ onConflictDoUpdate: onConflictMock });
      vi.mocked(db.insert).mockReturnValue({ values: valuesMock } as any);

      const req = makeReq("Bearer " + validToken);
      const principal = await mcpTokenService.verify(req);

      expect(principal.id).toBe("tok_123");
      expect(principal.name).toBe("Antigravity Assistant");
      expect(principal.readOnly).toBe(false);
      expect(principal.allowedScopes).toEqual(["*"]);
    });

    it("throws 429 when fixed-window rate limit exceeds 120 requests/minute", async () => {
      const validToken = "tff_" + "c".repeat(43);
      const tokenRecord = {
        id: "tok_456",
        name: "Busy Agent",
        prefix: validToken.slice(0, 10),
        readOnly: false,
        allowedScopes: ["*"],
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        lastUsedAt: new Date(),
        createdAt: new Date(),
      };

      const limitMock1 = vi.fn().mockResolvedValue([tokenRecord]);
      const whereMock1 = vi.fn().mockReturnValue({ limit: limitMock1 });
      const fromMock1 = vi.fn().mockReturnValue({ where: whereMock1 });

      vi.mocked(db.select).mockReturnValueOnce({ from: fromMock1 } as any);

      const returning = vi.fn().mockResolvedValue([{ count: 121 }]);
      const onConflictMock = vi.fn().mockReturnValue({ returning });
      const valuesMock = vi
        .fn()
        .mockReturnValue({ onConflictDoUpdate: onConflictMock });
      vi.mocked(db.insert).mockReturnValue({ values: valuesMock } as any);

      const req = makeReq("Bearer " + validToken);
      await expect(mcpTokenService.verify(req)).rejects.toMatchObject({
        statusCode: 429,
        message: expect.stringContaining("Rate limit exceeded"),
      });
    });
  });

  it("rotates an active token with one database statement", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce({
      rows: [{ id: "replacement", name: "Agent (Rotated)" }],
    } as any);
    const replacement = await mcpTokenService.rotateToken("old-token");
    expect(replacement).toMatchObject({
      id: "replacement",
      name: "Agent (Rotated)",
    });
    expect(replacement.token).toMatch(/^tff_/);
    expect(db.execute).toHaveBeenCalledOnce();
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  describe("Token Management Actions", () => {
    it("createToken saves token hash and returns plaintext token once", async () => {
      const createdRecord = {
        id: "tok_new_1",
        prefix: "tff_123456",
        name: "Agent CLI",
      };

      const returningMock = vi.fn().mockResolvedValue([createdRecord]);
      const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
      vi.mocked(db.insert).mockReturnValue({ values: valuesMock } as any);

      const res = await mcpTokenService.createToken({
        name: "Agent CLI",
        readOnly: true,
        allowedScopes: ["invoices"],
        expiresInDays: 30,
      });

      expect(res.id).toBe("tok_new_1");
      expect(res.token.startsWith("tff_")).toBe(true);
      expect(res.name).toBe("Agent CLI");
      expect(db.insert).toHaveBeenCalled();
    });

    it("revokeToken updates revokedAt timestamp", async () => {
      const returningMock = vi.fn().mockResolvedValue([{ id: "tok_1" }]);
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
      const setMock = vi.fn().mockReturnValue({ where: whereMock });
      vi.mocked(db.update).mockReturnValue({ set: setMock } as any);

      const revoked = await mcpTokenService.revokeToken("tok_1");
      expect(revoked).toBe(true);
      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
    });

    it("deleteToken deletes limits and token record", async () => {
      const returningMock = vi.fn().mockResolvedValue([{ id: "tok_1" }]);
      const whereMock2 = vi.fn().mockReturnValue({ returning: returningMock });
      const whereMock1 = vi.fn().mockResolvedValue(undefined);

      vi.mocked(db.delete)
        .mockReturnValueOnce({ where: whereMock1 } as any)
        .mockReturnValueOnce({ where: whereMock2 } as any);

      const deleted = await mcpTokenService.deleteToken("tok_1");
      expect(deleted).toBe(true);
      expect(db.delete).toHaveBeenCalledTimes(2);
    });
  });
});
