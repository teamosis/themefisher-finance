import { parseRemittancePdf } from "@/lib/mcp/remittance-pdf";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pdfBase64 = readFileSync(new URL("../fixtures/mt103-remittance-encrypted.pdf.base64", import.meta.url), "utf8").trim();

describe("MCP MT103 extraction", () => {
  it("extracts a draft from an encrypted advice PDF using the Node runtime", async () => {
    await expect(parseRemittancePdf({ pdfBase64, password: "fixture-remittance-password" })).resolves.toEqual({
      draft: {
        amount: 1234.5,
        receivedAmount: 1234.5,
        currency: "USD",
        invoiceDate: "2026-11-17",
        invoiceNumber: "TF-2026-11-17-01",
      },
      orderingCustomer: "Example Company",
      swiftCode: "SCBLBDDX",
      valueDate: "24/11/2026",
    });
  });

  it("returns actionable feedback for an incorrect file password", async () => {
    await expect(parseRemittancePdf({ pdfBase64, password: "wrong-password" }))
      .rejects.toThrow("The PDF password was incorrect");
  });
});
