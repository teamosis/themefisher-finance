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
] as const;

export type McpScopeKey = (typeof MCP_SCOPES)[number]["key"];

export const ALL_SCOPE_KEYS: McpScopeKey[] = MCP_SCOPES.map((s) => s.key);

export function getToolScope(toolName: string): McpScopeKey | "system" {
  if (toolName === "finance_get_overview") return "system";
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
  if (allowedScopes.includes("*")) return true;
  // The database cascade deletes this client's invoices as well.
  if (toolName === "finance_clients_delete") {
    return (
      allowedScopes.includes("clients") && allowedScopes.includes("invoices")
    );
  }
  return allowedScopes.includes(scope);
}
