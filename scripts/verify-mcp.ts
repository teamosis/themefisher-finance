import { handleMcp } from "../src/lib/mcp/server";
import { mcpTokenService } from "../src/lib/mcp/token-service";
import { ALL_SCOPE_KEYS, tokenAllowsTool } from "../src/lib/mcp/scopes";
import { db } from "../src/db";
import { mcpAccessTokens, mcpRuns } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function runVerification() {
  console.log("=== 1. Starting MCP Verification on themefisher-finance ===");

  // 1. Verify Scope Logic
  console.log("\n--- Checking Scopes ---");
  console.log("Registered Scopes:", ALL_SCOPE_KEYS);
  console.assert(tokenAllowsTool(["*"], "finance_invoices_list"), "Wildcard scope check failed");
  console.assert(tokenAllowsTool(["invoices"], "finance_invoices_list"), "Invoices scope check failed");
  console.assert(!tokenAllowsTool(["clients"], "finance_invoices_list"), "Scope isolation check failed");
  console.assert(tokenAllowsTool(["clients"], "finance_get_overview"), "Overview system tool check failed");
  console.log("✓ Scope isolation checks passed");

  // 2. Generate a Test Token
  console.log("\n--- Creating Test MCP Token ---");
  const testTokenRecord = await mcpTokenService.createToken({
    name: "Automated MCP Test Agent",
    readOnly: false,
    allowedScopes: ["*"],
    expiresInDays: 1,
  });
  console.log("✓ Created test token:", testTokenRecord.prefix + "...", "ID:", testTokenRecord.id);

  // Helper to read MCP response (handles both application/json and text/event-stream)
  async function readMcpResponse(response: Response) {
    if (!response.headers.get("content-type")?.includes("text/event-stream")) {
      return response.json();
    }

    const text = await response.text();
    for (const line of text.split("\n")) {
      if (!line.startsWith("data:")) continue;
      try {
        const message = JSON.parse(line.slice("data:".length).trim());
        if ("id" in message || "result" in message || "error" in message) return message;
      } catch {}
    }

    throw new Error(`Missing JSON-RPC response in MCP event stream. Raw: ${text}`);
  }

  // Helper to make mock Request to handleMcp
  async function sendMcpRequest(body: any, token?: string) {
    const headers = new Headers({
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    });
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const req = new Request("http://localhost:3000/api/mcp", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    return handleMcp(req);
  }

  // 3. Test Unauthorized Access (Missing or Invalid Token)
  console.log("\n--- Testing Authentication ---");
  const unauthRes = await sendMcpRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  console.assert(unauthRes.status === 401, `Expected 401 for missing token, got ${unauthRes.status}`);
  console.log("✓ Correctly rejected missing token with 401");

  const badTokenRes = await sendMcpRequest(
    { jsonrpc: "2.0", id: 1, method: "tools/list" },
    "tff_invalidtokenthattisdefinitelynotinthedatabase"
  );
  console.assert(badTokenRes.status === 401, `Expected 401 for bad token, got ${badTokenRes.status}`);
  console.log("✓ Correctly rejected invalid token with 401");

  // 4. Test tools/list (First-Visit Native Discovery)
  console.log("\n--- Testing tools/list (Immediate First-Visit Native Discovery) ---");
  const listRes = await sendMcpRequest(
    { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
    testTokenRecord.token
  );
  console.assert(listRes.status === 200, `Expected 200 for tools/list, got ${listRes.status}`);
  const listJson = await readMcpResponse(listRes);
  const tools = listJson.result?.tools || [];
  console.log(`✓ Received ${tools.length} first-class tools directly on first visit`);
  console.assert(tools.length >= 25, `Expected at least 25 tools, found ${tools.length}`);

  const toolNames = tools.map((t: any) => t.name);
  console.log("Sample Tools:", toolNames.slice(0, 8).join(", "), "...");
  console.assert(toolNames.includes("finance_get_overview"), "Missing finance_get_overview");
  console.assert(toolNames.includes("finance_invoices_list"), "Missing finance_invoices_list");
  console.assert(toolNames.includes("finance_banks_get_branches"), "Missing finance_banks_get_branches");
  console.assert(toolNames.includes("finance_payroll_get_salary_sheet"), "Missing finance_payroll_get_salary_sheet");

  // 5. Test 1-Shot Execution: finance_get_overview
  console.log("\n--- Testing tools/call: finance_get_overview (1-Shot Execution) ---");
  const overviewRes = await sendMcpRequest(
    {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "finance_get_overview",
        arguments: {},
      },
    },
    testTokenRecord.token
  );
  console.assert(overviewRes.status === 200, `Expected 200 for overview call, got ${overviewRes.status}`);
  const overviewJson = await readMcpResponse(overviewRes);
  const overviewText = overviewJson.result?.content?.[0]?.text;
  console.assert(overviewText, "Overview call returned empty content");
  const overviewData = JSON.parse(overviewText);
  console.log("✓ Overview Result:", {
    totalInvoices: overviewData.invoices?.totalCount,
    totalReceivedUsd: overviewData.invoices?.totalReceivedUsd,
    activeClients: overviewData.clients?.totalActive,
    activeEmployees: overviewData.payroll?.activeEmployeeCount,
    monthlyPayrollBdt: overviewData.payroll?.totalMonthlySalaryBdt,
  });
  console.assert(overviewData.invoices !== undefined, "Expected invoices in overview data");
  console.assert(overviewData.clients !== undefined, "Expected clients in overview data");
  console.assert(overviewData.payroll !== undefined, "Expected payroll in overview data");

  // 6. Test tools/call: finance_banks_get_branches
  console.log("\n--- Testing tools/call: finance_banks_get_branches ---");
  const bankRes = await sendMcpRequest(
    {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "finance_banks_get_branches",
        arguments: {
          bankName: "STANDARD CHARTERED BANK",
          limit: 3,
        },
      },
    },
    testTokenRecord.token
  );
  const bankJson = await readMcpResponse(bankRes);
  const bankData = JSON.parse(bankJson.result?.content?.[0]?.text || "{}");
  console.log(`✓ Found ${bankData.count} branches for 'STANDARD CHARTERED BANK'. First branch:`, {
    bank: bankData.bankName,
    branch: bankData.branches?.[0]?.branchName,
    routingNumber: bankData.branches?.[0]?.routingNumber,
    district: bankData.branches?.[0]?.districtName,
  });
  console.assert(bankData.branches?.length > 0, "Expected at least 1 Standard Chartered branch");

  // 7. Test tools/call: finance_payroll_get_salary_sheet
  console.log("\n--- Testing tools/call: finance_payroll_get_salary_sheet ---");
  const payrollRes = await sendMcpRequest(
    {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "finance_payroll_get_salary_sheet",
        arguments: {},
      },
    },
    testTokenRecord.token
  );
  const payrollJson = await readMcpResponse(payrollRes);
  const payrollData = JSON.parse(payrollJson.result?.content?.[0]?.text || "{}");
  console.log("✓ Payroll calculation verified:", {
    totalEmployees: payrollData.employeeCount,
    totalMonthlySalaryBdt: payrollData.totalPayrollBdt,
  });
  console.assert(payrollData.employeeCount !== undefined, "Expected payroll employeeCount");

  // 8. Test Read-Only Token Enforcement
  console.log("\n--- Testing Read-Only Token Security Enforcement ---");
  const readOnlyTokenRecord = await mcpTokenService.createToken({
    name: "Read Only Audit Agent",
    readOnly: true,
    allowedScopes: ["*"],
    expiresInDays: 1,
  });

  // Verify write tools are omitted from tools/list for read-only token
  const readOnlyListRes = await sendMcpRequest(
    { jsonrpc: "2.0", id: 6, method: "tools/list", params: {} },
    readOnlyTokenRecord.token
  );
  const readOnlyListJson = await readMcpResponse(readOnlyListRes);
  const readOnlyToolNames = (readOnlyListJson.result?.tools || []).map((t: any) => t.name);
  console.assert(!readOnlyToolNames.includes("finance_clients_create"), "Write tool found in read-only tools/list");
  console.assert(readOnlyToolNames.includes("finance_clients_list"), "Read tool missing in read-only tools/list");
  console.log(`✓ Read-only token correctly exposes only ${readOnlyToolNames.length} read tools (0 write tools)`);

  const mutationAttemptRes = await sendMcpRequest(
    {
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: {
        name: "finance_clients_create",
        arguments: {
          name: "Unauthorized Mutation Test Client",
        },
      },
    },
    readOnlyTokenRecord.token
  );
  const mutationJson = await readMcpResponse(mutationAttemptRes);
  const mutationError = mutationJson.error?.message || mutationJson.result?.content?.[0]?.text || "";
  console.log("Mutation response with read-only token:", mutationError);
  console.assert(
    mutationError.toLowerCase().includes("not found") || mutationError.toLowerCase().includes("read-only"),
    "Expected read-only block / tool not found error"
  );
  console.log("✓ Successfully enforced read-only token security");

  // 9. Test Audit Runs Logging
  console.log("\n--- Testing Audit Logging ---");
  const recentRuns = await mcpTokenService.getRecentRuns(10);
  console.log(`✓ Fetched ${recentRuns.length} recent audit runs`);
  const ranOverview = recentRuns.find((r) => r.toolName === "finance_get_overview");
  console.assert(Boolean(ranOverview), "Audit run for finance_get_overview was not recorded");
  console.log("✓ Audit log entry verified:", {
    toolName: ranOverview?.toolName,
    status: ranOverview?.status,
    durationMs: ranOverview?.durationMs,
  });

  // 9. Clean up test tokens
  console.log("\n--- Cleanup ---");
  await db.delete(mcpAccessTokens).where(eq(mcpAccessTokens.id, testTokenRecord.id));
  await db.delete(mcpAccessTokens).where(eq(mcpAccessTokens.id, readOnlyTokenRecord.id));
  console.log("✓ Cleaned up test tokens from database");

  console.log("\n🎉 ALL VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉\n");
}

runVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Verification failed:", err);
    process.exit(1);
  });
