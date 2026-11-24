import { format } from "date-fns";
import assert from "node:assert";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

describe("SCB Straight2Bank Bulk Transaction Excel Export Suite", () => {
  const mockVendors = [
    {
      id: "v1",
      receiver_name: "Rahim Ahmed",
      account_number: "1152203498001",
      bank_name: "Dutch-Bangla Bank PLC",
      branch_name: "Dhanmondi Branch",
      routing_number: "090271234",
    },
    {
      id: "v2",
      receiver_name: "Karim Ullah",
      account_number: "0001912345678",
      bank_name: "Standard Chartered Bank",
      branch_name: "Gulshan Branch",
      routing_number: "215260987",
    },
  ];

  it("maps transaction rows into exact SCB Straight2Bank bulk upload columns", () => {
    const activeDebit = "0001914137101";
    const transferDate = new Date("2026-11-24");
    const formattedDate = format(transferDate, "dd/MM/yyyy");

    const rows = [
      {
        vendorId: "v1",
        amount: "65000",
        description: "November 2026 Salary",
      },
      {
        vendorId: "v2",
        amount: "55000",
        description: "November 2026 Salary",
      },
    ];

    const excelData = rows.map((row) => {
      const vendor = mockVendors.find((v) => v.id === row.vendorId)!;
      return {
        "Customer Reference": "",
        "Beneficiary Name(120)": vendor.receiver_name,
        "Beneficiary Account Number": vendor.account_number,
        "Routing Number": vendor.routing_number,
        "Payment Amount": row.amount,
        "Reason(140)": row.description,
        "Date(DD/MM/YYYY)": formattedDate,
        "Debit Account Number(Prefix- 00 BDT)": activeDebit.trim(),
        "Beneficiary Email ID(Optional)": "",
      };
    });

    // Check Columns
    const expectedHeaders = [
      "Customer Reference",
      "Beneficiary Name(120)",
      "Beneficiary Account Number",
      "Routing Number",
      "Payment Amount",
      "Reason(140)",
      "Date(DD/MM/YYYY)",
      "Debit Account Number(Prefix- 00 BDT)",
      "Beneficiary Email ID(Optional)",
    ];

    expect(Object.keys(excelData[0])).toEqual(expectedHeaders);
    expect(excelData[0]["Beneficiary Name(120)"]).toBe("Rahim Ahmed");
    expect(excelData[0]["Payment Amount"]).toBe("65000");
    expect(excelData[0]["Date(DD/MM/YYYY)"]).toBe("24/11/2026");
    expect(excelData[0]["Debit Account Number(Prefix- 00 BDT)"]).toBe("0001914137101");
  });

  it("creates valid XLSX workbook and appends sheet correctly", () => {
    const data = [
      {
        "Customer Reference": "",
        "Beneficiary Name(120)": "Rahim Ahmed",
        "Beneficiary Account Number": "1152203498001",
        "Routing Number": "090271234",
        "Payment Amount": "65000",
        "Reason(140)": "Salary",
        "Date(DD/MM/YYYY)": "24/11/2026",
        "Debit Account Number(Prefix- 00 BDT)": "0001914137101",
        "Beneficiary Email ID(Optional)": "",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transfers");

    expect(workbook.SheetNames).toContain("Transfers");
    const jsonOutput = XLSX.utils.sheet_to_json(workbook.Sheets["Transfers"]);
    expect(jsonOutput).toHaveLength(1);
    expect((jsonOutput[0] as any)["Routing Number"]).toBe("090271234");
  });

  it("filters out unmapped or empty vendor rows", () => {
    const rows = [
      { vendorId: "v1", amount: "50000" },
      { vendorId: null, amount: "10000" }, // unmapped vendor
      { vendorId: "non_existent", amount: "20000" }, // missing vendor
    ];

    const mapped = rows
      .map((row) => {
        if (!row.vendorId) return null;
        const vendor = mockVendors.find((v) => v.id === row.vendorId);
        if (!vendor) return null;
        return {
          name: vendor.receiver_name,
          amount: row.amount,
        };
      })
      .filter(Boolean);

    expect(mapped).toHaveLength(1);
    expect(mapped[0]?.name).toBe("Rahim Ahmed");
  });
});
