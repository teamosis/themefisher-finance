import {
  createMcpTokenAction,
  deleteMcpTokenAction,
  getMcpRecentRunsAction,
  revokeMcpTokenAction,
  rotateMcpTokenAction,
} from "@/actions/mcp";
import { mcpTokenService } from "@/lib/mcp/token-service";
import {
  afterEach,
  describe,
  beforeEach as establishBeforeEach,
  expect,
  it,
  vi,
} from "vitest";
import { establishBrowserSession } from "../browser-session-fixture";

vi.mock("@/lib/mcp/token-service", () => ({
  getMcpOrigin: vi.fn(() => "http://localhost:3000"),
  mcpTokenService: {
    listTokens: vi.fn(),
    createToken: vi.fn(),
    revokeToken: vi.fn(),
    deleteToken: vi.fn(),
    rotateToken: vi.fn(),
    getRecentRuns: vi.fn(),
  },
}));

establishBeforeEach(establishBrowserSession);

describe("MCP Server Actions Suite", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("createMcpTokenAction", () => {
    it("rejects token creation when name is empty or whitespace", async () => {
      await expect(createMcpTokenAction({ name: "   " })).rejects.toThrow(
        "Agent / Token name is required",
      );
    });

    it("creates token, builds client configuration and setup prompt", async () => {
      vi.mocked(mcpTokenService.createToken).mockResolvedValueOnce({
        id: "tok_123",
        token: "tff_secret_key_12345",
        prefix: "tff_secret",
        name: "Cursor Assistant",
      });

      const res = await createMcpTokenAction({
        name: "Cursor Assistant",
        readOnly: false,
        allowedScopes: ["invoices"],
      });

      expect(res.id).toBe("tok_123");
      expect(res.token).toBe("tff_secret_key_12345");
      expect(res.prompt).toContain("http://localhost:3000/api/mcp");
      expect(res.prompt).toContain("tff_secret_key_12345");
      expect(res.mcpConfig).toContain('"themefisher-finance"');
    });
  });

  describe("token lifecycle actions", () => {
    it("revokeMcpTokenAction calls service and returns boolean", async () => {
      vi.mocked(mcpTokenService.revokeToken).mockResolvedValueOnce(true);
      const res = await revokeMcpTokenAction("tok_123");
      expect(res).toBe(true);
      expect(mcpTokenService.revokeToken).toHaveBeenCalledWith("tok_123");
    });

    it("deleteMcpTokenAction calls service and returns boolean", async () => {
      vi.mocked(mcpTokenService.deleteToken).mockResolvedValueOnce(true);
      const res = await deleteMcpTokenAction("tok_123");
      expect(res).toBe(true);
      expect(mcpTokenService.deleteToken).toHaveBeenCalledWith("tok_123");
    });

    it("rotateMcpTokenAction replaces token with new active token and setup credentials", async () => {
      vi.mocked(mcpTokenService.rotateToken).mockResolvedValueOnce({
        id: "tok_rotated_123",
        token: "tff_new_rotated_key",
        prefix: "tff_new_ro",
        name: "Cursor Assistant (Rotated)",
      });

      const res = await rotateMcpTokenAction("tok_123");
      expect(res.id).toBe("tok_rotated_123");
      expect(res.token).toBe("tff_new_rotated_key");
      expect(res.mcpConfig).toContain("tff_new_rotated_key");
    });

    it("getMcpRecentRunsAction queries service audit logs", async () => {
      const mockRuns = [
        { id: "run_1", toolName: "finance_get_overview", status: "completed" },
      ];
      vi.mocked(mcpTokenService.getRecentRuns).mockResolvedValueOnce(
        mockRuns as any,
      );

      const res = await getMcpRecentRunsAction(20);
      expect(res).toEqual(mockRuns);
      expect(mcpTokenService.getRecentRuns).toHaveBeenCalledWith(20);
    });
  });
});
