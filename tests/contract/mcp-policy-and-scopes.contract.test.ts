import { mcpClientConfig, redact, setupPrompt } from "@/lib/mcp/policy";
import { tokenAllowsTool } from "@/lib/mcp/scopes";
import { describe, expect, it } from "vitest";

describe("MCP Policy & Scopes Contract Suite", () => {
  describe("tokenAllowsTool scope evaluation", () => {
    it("wildcard scope ['*'] permits all tools without exception", () => {
      const allWildcard = ["*"];
      expect(tokenAllowsTool(allWildcard, "finance_get_overview")).toBe(true);
      expect(tokenAllowsTool(allWildcard, "finance_invoices_list")).toBe(true);
      expect(tokenAllowsTool(allWildcard, "finance_invoices_create")).toBe(
        true,
      );
      expect(tokenAllowsTool(allWildcard, "finance_vendors_delete")).toBe(true);
      expect(tokenAllowsTool(allWildcard, "finance_banks_get_names")).toBe(
        true,
      );
    });

    it("system scope allows system tools only", () => {
      const systemScope = ["system"];
      expect(tokenAllowsTool(systemScope, "finance_get_overview")).toBe(true);
      expect(tokenAllowsTool(systemScope, "finance_invoices_list")).toBe(false);
      expect(tokenAllowsTool(systemScope, "finance_vendors_list")).toBe(false);
    });

    it("domain scope permits all tools matching domain prefix and rejects others", () => {
      const invoicesScope = ["invoices"];
      expect(tokenAllowsTool(invoicesScope, "finance_invoices_list")).toBe(
        true,
      );
      expect(tokenAllowsTool(invoicesScope, "finance_invoices_create")).toBe(
        true,
      );
      expect(tokenAllowsTool(invoicesScope, "finance_invoices_delete")).toBe(
        true,
      );

      // Rejects out of scope tools
      expect(tokenAllowsTool(invoicesScope, "finance_clients_create")).toBe(
        false,
      );
      expect(tokenAllowsTool(invoicesScope, "finance_vendors_list")).toBe(
        false,
      );
      expect(
        tokenAllowsTool(invoicesScope, "finance_accounts_list_debit"),
      ).toBe(false);
    });

    it("supports multiple combined scopes", () => {
      const combined = ["clients", "banking"];
      expect(tokenAllowsTool(combined, "finance_clients_list")).toBe(true);
      expect(tokenAllowsTool(combined, "finance_clients_create")).toBe(true);
      expect(tokenAllowsTool(combined, "finance_banks_lookup_routing")).toBe(
        true,
      );

      expect(tokenAllowsTool(combined, "finance_invoices_list")).toBe(false);
      expect(
        tokenAllowsTool(combined, "finance_payroll_get_salary_sheet"),
      ).toBe(false);
    });

    it("requires both client and invoice scopes for a cascading client deletion", () => {
      const tool = "finance_clients_delete";
      expect(tokenAllowsTool(["clients"], tool)).toBe(false);
      expect(tokenAllowsTool(["invoices"], tool)).toBe(false);
      expect(tokenAllowsTool(["clients", "invoices"], tool)).toBe(true);
      expect(tokenAllowsTool(["*"], tool)).toBe(true);
    });
  });

  describe("redact output sanitizer", () => {
    it("strips confidential credential keys recursively from objects and arrays", () => {
      const sensitiveData = {
        id: "123",
        name: "Test Agent",
        token: "tff_secret_token_12345",
        tokenHash: "abcdef64byteshash",
        secret: "super_secret",
        password: "my_password",
        authorization: "Bearer tff_token",
        nested: {
          clientName: "Envato",
          apiKey: "key_xyz",
          credentialDetails: "cred123",
          safeNumber: 42,
        },
        list: [{ safeField: "ok", token: "drop_me" }, "plain_string"],
      };

      const cleaned = redact(sensitiveData) as Record<string, any>;

      expect(cleaned.id).toBe("123");
      expect(cleaned.name).toBe("Test Agent");
      expect(cleaned.token).toBeUndefined();
      expect(cleaned.tokenHash).toBeUndefined();
      expect(cleaned.secret).toBeUndefined();
      expect(cleaned.password).toBeUndefined();
      expect(cleaned.authorization).toBeUndefined();

      expect(cleaned.nested.clientName).toBe("Envato");
      expect(cleaned.nested.safeNumber).toBe(42);
      expect(cleaned.nested.credentialDetails).toBeUndefined();

      expect(cleaned.list[0].safeField).toBe("ok");
      expect(cleaned.list[0].token).toBeUndefined();
    });

    it("converts Date objects to ISO string timestamps", () => {
      const d = new Date("2026-11-24T12:00:00.000Z");
      const result = redact({ createdAt: d }) as { createdAt: string };
      expect(result.createdAt).toBe("2026-11-24T12:00:00.000Z");
    });

    it("handles primitives, null, and undefined without errors", () => {
      expect(redact(null)).toBeNull();
      expect(redact(undefined)).toBeUndefined();
      expect(redact(12345)).toBe(12345);
      expect(redact("safe string")).toBe("safe string");
      expect(redact(true)).toBe(true);
    });
  });

  it("requires explicit payment operations permissions and access to funding account data", () => {
    expect(tokenAllowsTool(["*"], "finance_payouts_approve")).toBe(false);
    expect(tokenAllowsTool(["payment_requests"], "finance_payouts_approve")).toBe(false);
    expect(tokenAllowsTool(["payment_operations"], "finance_payouts_approve")).toBe(true);
    for (const tool of ["finance_payouts_export", "finance_payouts_get_workbook"]) {
      expect(tokenAllowsTool(["payment_operations"], tool)).toBe(false);
      expect(tokenAllowsTool(["payment_operations", "accounts"], tool)).toBe(true);
    }
    expect(tokenAllowsTool(["vendors"], "finance_scb_prepare_workbook")).toBe(false);
    expect(tokenAllowsTool(["vendors", "accounts"], "finance_scb_prepare_workbook")).toBe(true);
  });

  describe("mcpClientConfig & setupPrompt", () => {
    it("generates valid JSON client configuration with Bearer token header", () => {
      const jsonStr = mcpClientConfig(
        "https://finance.example.com",
        "tff_abc123",
      );
      const config = JSON.parse(jsonStr);

      expect(config.mcpServers["themefisher-finance"].url).toBe(
        "https://finance.example.com/api/mcp",
      );
      expect(
        config.mcpServers["themefisher-finance"].headers.Authorization,
      ).toBe("Bearer tff_abc123");
    });

    it("generates setup prompt containing target URL and security guidance", () => {
      const prompt = setupPrompt("http://localhost:3000", "tff_test_token");
      expect(prompt).toContain("http://localhost:3000/api/mcp");
      expect(prompt).toContain("Bearer tff_test_token");
      expect(prompt).toContain("call finance_get_overview");
    });
  });
});
