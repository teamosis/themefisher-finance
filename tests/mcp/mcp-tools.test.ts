import { db } from "@/db";
import { tools } from "@/lib/mcp/tools";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => {
  const mockDb = {
    select: vi.fn(),
    selectDistinct: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  return { db: mockDb };
});

vi.mock("@/actions/banks", () => ({
  lookupSwiftCode: vi.fn(async (swift: string) => {
    if (swift === "SCBLBDDX") {
      return { bank_name: "Standard Chartered Bank", country: "BD" };
    }
    return null;
  }),
}));

describe("MCP Tools Registry & Handlers Suite", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const getTool = (name: string) => {
    const t = tools.find((tool) => tool.name === name);
    if (!t) throw new Error(`Tool '${name}' not registered`);
    return t;
  };

  it("reports ambiguous branch names instead of choosing a routing number", async () => {
    const limit = vi.fn().mockResolvedValue([
      { branchName: "Sadar", routingNumber: "012345678" },
      { branchName: "Sadar", routingNumber: "098765432" },
    ]);
    const from = vi.fn().mockReturnValue({ where: () => ({ limit }) });
    vi.mocked(db.select).mockReturnValueOnce({ from } as any);

    const tool = getTool("finance_banks_lookup_routing");
    await expect(
      tool.handler({ bankName: "Test Bank", branchName: "Sadar" }),
    ).rejects.toThrow("Multiple routing numbers");
    expect(limit).toHaveBeenCalledWith(2);
  });

  it("registers all financial domain tools across expected scopes", () => {
    const names = tools.map((t) => t.name);

    expect(names).toContain("finance_get_overview");
    expect(names).toContain("finance_invoices_list");
    expect(names).toContain("finance_invoices_get");
    expect(names).toContain("finance_invoices_create");
    expect(names).toContain("finance_invoices_update");
    expect(names).toContain("finance_invoices_delete");

    expect(names).toContain("finance_clients_list");
    expect(names).toContain("finance_clients_get");
    expect(names).toContain("finance_clients_create");
    expect(names).toContain("finance_clients_update");
    expect(names).toContain("finance_clients_delete");

    expect(names).toContain("finance_vendors_list");
    expect(names).toContain("finance_vendors_get");
    expect(names).toContain("finance_vendors_create");
    expect(names).toContain("finance_vendors_update");
    expect(names).toContain("finance_vendors_delete");

    expect(names).toContain("finance_payroll_get_salary_sheet");

    expect(names).toContain("finance_banks_get_names");
    expect(names).toContain("finance_banks_get_branches");
    expect(names).toContain("finance_banks_lookup_routing");
    expect(names).toContain("finance_banks_lookup_swift");

    expect(names).toContain("finance_accounts_list_debit");
    expect(names).toContain("finance_accounts_set_default_debit");
    expect(names).toContain("finance_accounts_list_payment");
    expect(names).toContain("finance_accounts_create_payment");

    expect(names).toContain("finance_logs_list");
    expect(names).toContain("finance_logs_get_excel_export");

    expect(names).toContain("finance_payment_requests_list");
    expect(names).toContain("finance_payment_requests_get");
    expect(names).toContain("finance_payment_requests_verify");
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(expect.arrayContaining([
      "finance_accounts_create_debit",
      "finance_accounts_update_debit",
      "finance_accounts_delete_debit",
      "finance_accounts_delete_payment",
      "finance_scb_prepare_workbook",
      "finance_payouts_submit",
      "finance_payouts_approve",
      "finance_payouts_reject",
      "finance_payouts_export",
      "finance_payouts_get_workbook",
      "finance_logs_list_mcp_runs",
    ]));
  });

  it("prepares a readable SCB workbook with string account and routing identifiers", async () => {
    const vendorId = "0bfce681-c13d-4b89-b6d8-47e425c35ad6";
    const debitAccountId = "bbde12ea-6467-4e0b-bef6-e2ac87f92c63";
    vi.mocked(db.select)
      .mockReturnValueOnce({
        from: () => ({ where: () => ({ limit: async () => [{ accountNumber: "000010203" }] }) }),
      } as any)
      .mockReturnValueOnce({
        from: () => ({ where: async () => [{
          id: vendorId, name: "Example Payee", accountNumber: "000404", routingNumber: "012345678",
        }] }),
      } as any);

    const tool = getTool("finance_scb_prepare_workbook");
    const result = await tool.handler({
      type: "transfers", debitAccountId, paymentDate: "2026-11-24",
      items: [{ vendorId, amount: "25.50" }],
    }, ["vendors", "accounts"]) as { xlsxBase64: string; count: number };
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(result.xlsxBase64, { type: "base64" });
    expect(result.count).toBe(1);
    expect(XLSX.utils.sheet_to_json(workbook.Sheets.Transfers)).toEqual([
      expect.objectContaining({
        "Beneficiary Account Number": "000404",
        "Routing Number": "012345678",
        "Payment Amount": "25.50",
        "Date(DD/MM/YYYY)": "24/11/2026",
        "Debit Account Number(Prefix- 00 BDT)": "000010203",
      }),
    ]);
  });

  describe("System Overview Tool: finance_get_overview", () => {
    it("does not query financial data for a banking-only token", async () => {
      const tool = getTool("finance_get_overview");
      await expect(tool.handler({}, ["banking"])).resolves.toEqual({
        connected: true,
      });
      expect(db.select).not.toHaveBeenCalled();
    });

    it("aggregates invoice stats, client count, payroll budget, and default debit account", async () => {
      const tool = getTool("finance_get_overview");

      const fromMock1 = vi
        .fn()
        .mockResolvedValue([
          { totalCount: 15, totalAmount: "75000", totalReceived: "74800" },
        ]);
      const fromMock2 = vi.fn().mockResolvedValue([{ count: 5 }]);
      const whereMock3 = vi
        .fn()
        .mockResolvedValue([{ headcount: 12, monthlyPayrollBdt: "850000" }]);
      const fromMock3 = vi.fn().mockReturnValue({ where: whereMock3 });
      const limitMock4 = vi.fn().mockResolvedValue([
        {
          accountNumber: "0001914137101",
          bankName: "Standard Chartered Bank",
        },
      ]);
      const whereMock4 = vi.fn().mockReturnValue({ limit: limitMock4 });
      const fromMock4 = vi.fn().mockReturnValue({ where: whereMock4 });

      vi.mocked(db.select)
        .mockReturnValueOnce({ from: fromMock1 } as any)
        .mockReturnValueOnce({ from: fromMock2 } as any)
        .mockReturnValueOnce({ from: fromMock3 } as any)
        .mockReturnValueOnce({ from: fromMock4 } as any);

      const result = (await tool.handler({}, ["*"])) as any;

      expect(result.invoices.totalCount).toBe(15);
      expect(result.invoices.totalAmountUsd).toBe(75000);
      expect(result.invoices.totalReceivedUsd).toBe(74800);
      expect(result.clients.totalActive).toBe(5);
      expect(result.payroll.activeEmployeeCount).toBe(12);
      expect(result.payroll.totalMonthlySalaryBdt).toBe(850000);
      expect(result.defaultScbDebitAccount.accountNumber).toBe("0001914137101");
    });
  });

  describe("Invoice Tools", () => {
    it("finance_invoices_list supports search, client filtering, and pagination", async () => {
      const tool = getTool("finance_invoices_list");
      const mockItems = [
        { id: "inv_1", invoiceNumber: "TF-2026-11-24-01", amount: "5000" },
      ];

      const offsetMock = vi.fn().mockResolvedValue(mockItems);
      const limitMock = vi.fn().mockReturnValue({ offset: offsetMock });
      const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
      const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
      const leftJoinMock = vi.fn().mockReturnValue({ where: whereMock });
      const fromMock1 = vi.fn().mockReturnValue({ leftJoin: leftJoinMock });

      const countMock = vi.fn().mockResolvedValue([{ count: 1 }]);
      const fromMock2 = vi.fn().mockReturnValue({ where: countMock });

      vi.mocked(db.select)
        .mockReturnValueOnce({ from: fromMock1 } as any)
        .mockReturnValueOnce({ from: fromMock2 } as any);

      const result = (await tool.handler({
        search: "TF-2026",
        limit: 10,
        offset: 0,
      })) as any;

      expect(result.items).toEqual(mockItems);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it("finance_invoices_create inserts invoice and returns created record", async () => {
      const tool = getTool("finance_invoices_create");
      const createdRow = {
        id: "inv_created_1",
        invoice_number: "TF-2026-11-24-99",
        amount: "5000",
      };

      const returningMock = vi.fn().mockResolvedValue([createdRow]);
      const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
      vi.mocked(db.insert).mockReturnValue({ values: valuesMock } as any);

      const result = (await tool.handler({
        clientId: "123e4567-e89b-12d3-a456-426614174000",
        invoiceNumber: "TF-2026-11-24-99",
        invoiceDate: "2026-11-24",
        amount: 5000,
        description: "Custom Web Application",
        paymentMethods: ["Wire Transfer"],
      })) as any;

      expect(result.success).toBe(true);
      expect(result.invoice).toEqual(createdRow);
    });
  });

  describe("Vendor & Payroll Tools", () => {
    it("finance_payroll_get_salary_sheet aggregates payroll total across employees", async () => {
      const tool = getTool("finance_payroll_get_salary_sheet");
      const mockEmployees = [
        { id: "e1", receiver_name: "Engineer 1", salary: "80000" },
        { id: "e2", receiver_name: "Engineer 2", salary: "70000" },
      ];

      const orderByMock = vi.fn().mockResolvedValue(mockEmployees);
      const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      vi.mocked(db.select).mockReturnValue({ from: fromMock } as any);

      const result = (await tool.handler({})) as any;

      expect(result.employeeCount).toBe(2);
      expect(result.totalPayrollBdt).toBe(150000); // 80k + 70k
      expect(result.employees[0].salaryBdt).toBe(80000);
    });
  });

  describe("Bank Routing Tools", () => {
    it("finance_banks_lookup_swift resolves bank details via SWIFT code lookup", async () => {
      const tool = getTool("finance_banks_lookup_swift");
      const result = (await tool.handler({ swiftCode: "SCBLBDDX" })) as any;

      expect(result.bank_name).toBe("Standard Chartered Bank");
      expect(result.country).toBe("BD");
    });
  });
});
