export const MCP_SCOPES = [
  {
    key: "invoices",
    label: "Invoices & Remittances",
    description: "Read, create, update, and manage inward remittance invoices",
    prefixes: ["finance_invoices_"],
  },
  {
    key: "clients",
    label: "International Clients",
    description: "Read and manage client profiles and receiving bank details",
    prefixes: ["finance_clients_"],
  },
  {
    key: "vendors",
    label: "Beneficiaries & Vendors",
    description:
      "Read, create, update, and manage vendor/employee beneficiary accounts",
    prefixes: ["finance_vendors_"],
  },
  {
    key: "payroll",
    label: "Payroll & Salaries",
    description:
      "Calculate employee salary sheets and payroll statistics for SCB export",
    prefixes: ["finance_payroll_"],
  },
  {
    key: "banking",
    label: "Bank Routing & SWIFT",
    description:
      "Access 11,426 Bangladesh bank branches, 9-digit routing codes, and SWIFT lookups",
    prefixes: ["finance_banks_"],
  },
  {
    key: "accounts",
    label: "Bank & Debit Accounts",
    description:
      "Manage Standard Chartered funding debit accounts and Themefisher receiving accounts",
    prefixes: ["finance_accounts_"],
  },
  {
    key: "logs",
    label: "Activity & Audit Logs",
    description:
      "Read audit logs for generated SCB Excel sheets, invoices, and bank operations",
    prefixes: ["finance_logs_"],
  },
  {
    key: "payment_requests",
    label: "Payment Requests & Claims",
    description:
      "Read, audit, and verify submitted public beneficiary payment requests",
    prefixes: ["finance_payment_requests_"],
  },
  {
    key: "payment_operations",
    label: "Payment Request Decisions & Exports",
    description: "Submit, approve, reject, and export payment requests after operator review",
    prefixes: ["finance_payouts_"],
  },
] as const;

export type McpScopeKey = (typeof MCP_SCOPES)[number]["key"];

export const ALL_SCOPE_KEYS: McpScopeKey[] = MCP_SCOPES.map((s) => s.key);

export const DEFAULT_SCOPE_KEYS = ALL_SCOPE_KEYS.filter((scope) => scope !== "payment_operations");

export function getToolScope(toolName: string): McpScopeKey | "system" {
  if (toolName === "finance_get_overview") return "system";
  if (toolName === "finance_scb_prepare_workbook") return "vendors";
  for (const scope of MCP_SCOPES) {
    if (scope.prefixes.some((prefix) => toolName.startsWith(prefix))) {
      return scope.key;
    }
  }
  return "system";
}

export function tokenAllowsTool(
  allowedScopes: string[] | null | undefined,
  toolName: string,
): boolean {
  if (toolName === "finance_get_overview") return true;
  const scope = getToolScope(toolName);
  if (scope === "system" || !allowedScopes?.length) return false;
  if (scope === "payment_operations") {
    if (!allowedScopes.includes(scope)) return false;
    if (toolName === "finance_payouts_export" || toolName === "finance_payouts_get_workbook") {
      return allowedScopes.includes("accounts") || allowedScopes.includes("*");
    }
    return true;
  }
  if (toolName === "finance_scb_prepare_workbook") {
    return allowedScopes.includes("*") || (allowedScopes.includes("accounts") && allowedScopes.includes("vendors"));
  }
  if (allowedScopes.includes("*")) return true;
  // The database cascade deletes this client's invoices as well.
  if (toolName === "finance_clients_delete") {
    return (
      allowedScopes.includes("clients") && allowedScopes.includes("invoices")
    );
  }
  return allowedScopes.includes(scope);
}
