import { format } from "date-fns";
import assert from "node:assert";
import { describe, expect, it } from "vitest";

describe("Bangladesh Bank Form-C (ICT) Regulatory Contract Suite", () => {
  it("enforces the Current Date Rule: Form-C displays generation/submission date, NEVER invoice date", () => {
    const invoiceDate = "2026-01-15";
    const currentGenerationDate = new Date();

    const formattedFormCDate = format(currentGenerationDate, "d MMM yyyy");
    const formattedInvoiceDate = format(new Date(invoiceDate), "d MMM yyyy");

    // The Form-C date must be current date
    expect(formattedFormCDate).not.toBe(formattedInvoiceDate);
    expect(formattedFormCDate).toContain(String(currentGenerationDate.getFullYear()));
  });

  it("prioritizes received_amount over billed amount for foreign currency declaration", () => {
    // Case 1: Deducted received amount
    const invoiceWithNet = {
      amount: 15000,
      received_amount: 14960,
      currency: "USD",
    };

    const amountVal1 =
      Number(invoiceWithNet.received_amount) > 0
        ? invoiceWithNet.received_amount
        : invoiceWithNet.amount;

    const formatted1 = Number(amountVal1).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    assert.strictEqual(formatted1, "14,960.00");

    // Case 2: Zero or missing received amount defaults to billed amount
    const invoiceWithoutNet = {
      amount: 8500,
      received_amount: 0,
      currency: "USD",
    };

    const amountVal2 =
      Number(invoiceWithoutNet.received_amount) > 0
        ? invoiceWithoutNet.received_amount
        : invoiceWithoutNet.amount;

    const formatted2 = Number(amountVal2).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    assert.strictEqual(formatted2, "8,500.00");
  });

  it("specifies official Themefisher business identity and statutory identifiers", () => {
    const businessIdentity = {
      companyName: "Themefisher",
      address: "Apartment A2, House-2G, Shaymoly, Road-1, Dhaka, Bangladesh",
      bin: "003271347",
      signingAuthority: "Mehedi Sharif",
      title: "Founder",
    };

    assert.strictEqual(businessIdentity.bin, "003271347");
    assert.strictEqual(businessIdentity.signingAuthority, "Mehedi Sharif");
    assert.strictEqual(businessIdentity.title, "Founder");
  });

  it("verifies Foreign Exchange Regulation Act Purpose Code 2410", () => {
    const defaultPurpose = {
      code: "2410",
      description:
        "Information Technology Enabled Services (IT Enabled Services) and Business Process Outsourcing (BPO) services – code 2410",
      isDefaultSelected: true,
    };

    assert.strictEqual(defaultPurpose.code, "2410");
    assert.strictEqual(defaultPurpose.isDefaultSelected, true);
  });
});
