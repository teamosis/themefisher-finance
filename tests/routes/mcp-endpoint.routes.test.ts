import { DELETE, GET, POST } from "@/app/api/mcp/route";
import { mcpTokenService } from "@/lib/mcp/token-service";
import assert from "node:assert";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mcp/token-service", () => {
  class MockMcpAuthError extends Error {
    constructor(message: string, public statusCode: number = 401) {
      super(message);
      this.name = "McpAuthError";
    }
  }

  return {
    McpAuthError: MockMcpAuthError,
    mcpTokenService: {
      verify: vi.fn(),
      recordRun: vi.fn().mockResolvedValue({ id: "run_1" }),
    },
    getMcpOrigin: () => "http://localhost:3000",
  };
});

describe("MCP API Route Handler (/api/mcp) Suite", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("HTTP Method Enforcement", () => {
    it("rejects GET requests with 405 Method Not Allowed and Allow: POST header", async () => {
      const res = await GET();
      assert.strictEqual(res.status, 405);
      assert.strictEqual(res.headers.get("Allow"), "POST");
    });

    it("rejects DELETE requests with 405 Method Not Allowed", async () => {
      const res = await DELETE();
      assert.strictEqual(res.status, 405);
      assert.strictEqual(res.headers.get("Allow"), "POST");
    });
  });

  describe("Payload Limits and Message Rules", () => {
    it("rejects payloads exceeding 256KB with 413 Payload Too Large", async () => {
      const oversizedReq = new Request("http://localhost:3000/api/mcp", {
        method: "POST",
        headers: {
          authorization: "Bearer tff_" + "a".repeat(43),
          "content-length": "300000", // > 256KB
        },
        body: JSON.stringify({ huge: "x".repeat(300000) }),
      });

      const res = await POST(oversizedReq);
      assert.strictEqual(res.status, 413);
      const data = await res.json();
      expect(data.error).toBe("Request payload too large");
    });

    it("rejects JSON-RPC batch message arrays with 400 Bad Request", async () => {
      vi.mocked(mcpTokenService.verify).mockResolvedValueOnce({
        id: "tok_1",
        name: "Agent",
        readOnly: false,
        allowedScopes: ["*"],
      } as any);

      const batchReq = new Request("http://localhost:3000/api/mcp", {
        method: "POST",
        headers: {
          authorization: "Bearer tff_" + "a".repeat(43),
          "content-type": "application/json",
        },
        body: JSON.stringify([
          { jsonrpc: "2.0", id: 1, method: "tools/list" },
          { jsonrpc: "2.0", id: 2, method: "tools/list" },
        ]),
      });

      const res = await POST(batchReq);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      expect(data.error).toBe("Batch messages are not supported");
    });
  });

  describe("Authentication Barrier", () => {
    it("returns 401 with WWW-Authenticate header when Bearer token is rejected", async () => {
      const { McpAuthError } = await import("@/lib/mcp/token-service");
      vi.mocked(mcpTokenService.verify).mockRejectedValueOnce(
        new McpAuthError("Bearer token required in Authorization header", 401),
      );

      const unauthReq = new Request("http://localhost:3000/api/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      });

      const res = await POST(unauthReq);
      assert.strictEqual(res.status, 401);
      assert.strictEqual(
        res.headers.get("WWW-Authenticate"),
        "Bearer realm=themefisher-finance-mcp",
      );
    });
  });
});
