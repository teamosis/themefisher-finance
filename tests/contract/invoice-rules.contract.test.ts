import { format } from "date-fns";
import assert from "node:assert";
import { describe, expect, it } from "vitest";

// Extracted date parsing helper mirroring BankInvoice.tsx
function parseInvoiceDate(dateStr?: string): Date {
  if (!dateStr) return new Date();
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  const parts = dateStr.split(/[-/ ]/);
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const months = [
      "jan", "feb", "mar", "apr", "may", "jun",
      "jul", "aug", "sep", "oct", "nov", "dec",
    ];
    const month = months.indexOf(parts[1].toLowerCase());
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    if (!isNaN(day) && month !== -1 && !isNaN(year)) {
      return new Date(year, month, day);
    }
  }
  return new Date();
}

describe("Invoice Rules & Calculation Contract Suite", () => {
  describe("Invoice Number Convention", () => {
    it("validates TF-YYYY-MM-DD-XX invoice number structure", () => {
      const validNumbers = [
        "TF-2026-11-24-01",
        "TF-2026-01-05-99",
        "TF-2025-12-31-10",
      ];
      const pattern = /^TF-\d{4}-\d{2}-\d{2}-\d{2}$/;

      for (const num of validNumbers) {
        expect(num).toMatch(pattern);
      }

      const invalidNumbers = [
        "INV-12345",
        "TF-2026-1-1-1",
        "TF-2026-11-24",
        "tf-2026-11-24-01", // must be uppercase
        "TF-26-11-24-01",
      ];
      for (const num of invalidNumbers) {
        expect(num).not.toMatch(pattern);
      }
    });
  });

  describe("Amount Arithmetic & Intermediary Deductions", () => {
    it("calculates intermediary bank deductions when net received amount is less than billed amount", () => {
      const billedAmount = 5000.0;
      const netReceivedAmount = 4985.0; // $15 intermediary fee deducted
      const fee = billedAmount - netReceivedAmount;

      assert.strictEqual(fee, 15.0);
      expect(netReceivedAmount).toBeLessThan(billedAmount);
    });

    it("safely formats numeric amounts with 2 decimal places", () => {
      const amount1 = 2500;
      const amount2 = 4250.5;
      const amount3 = "3890.75";

      expect(Number(amount1).toFixed(2)).toBe("2500.00");
      expect(Number(amount2).toFixed(2)).toBe("4250.50");
      expect(Number(amount3).toFixed(2)).toBe("3890.75");
    });

    it("defaults received_amount to billed amount when omitted or zero", () => {
      const invoiceWithoutReceived = {
        amount: 3500,
        received_amount: 0,
      };

      const effectiveReceived =
        Number(invoiceWithoutReceived.received_amount) > 0
          ? invoiceWithoutReceived.received_amount
          : invoiceWithoutReceived.amount;

      assert.strictEqual(effectiveReceived, 3500);
    });
  });

  describe("Date Parsing and Sales Period Calculation", () => {
    it("parses ISO YYYY-MM-DD dates accurately", () => {
      const d = parseInvoiceDate("2026-08-15");
      expect(d.getFullYear()).toBe(2026);
      expect(d.getMonth()).toBe(7); // August is month index 7
      expect(d.getDate()).toBe(15);
    });

    it("parses d-MMM-yy formats accurately (e.g. 15-aug-26)", () => {
      const d = parseInvoiceDate("15-aug-26");
      expect(d.getFullYear()).toBe(2026);
      expect(d.getMonth()).toBe(7);
      expect(d.getDate()).toBe(15);
    });

    it("calculates sales period spanning first day to last day of invoice month", () => {
      const parsedDate = parseInvoiceDate("2026-08-15");
      const startOfMonth = new Date(
        parsedDate.getFullYear(),
        parsedDate.getMonth(),
        1,
      );
      const endOfMonth = new Date(
        parsedDate.getFullYear(),
        parsedDate.getMonth() + 1,
        0,
      );

      const periodStart = format(startOfMonth, "d-MMM-yyyy");
      const periodEnd = format(endOfMonth, "d-MMM-yyyy");

      expect(periodStart).toBe("1-Aug-2026");
      expect(periodEnd).toBe("31-Aug-2026");
    });

    it("correctly computes February end-of-month in leap years vs non-leap years", () => {
      // Leap year 2024
      const leapFeb = parseInvoiceDate("2024-02-10");
      const endLeap = new Date(leapFeb.getFullYear(), leapFeb.getMonth() + 1, 0);
      expect(format(endLeap, "d-MMM-yyyy")).toBe("29-Feb-2024");

      // Non-leap year 2025
      const nonLeapFeb = parseInvoiceDate("2025-02-10");
      const endNonLeap = new Date(
        nonLeapFeb.getFullYear(),
        nonLeapFeb.getMonth() + 1,
        0,
      );
      expect(format(endNonLeap, "d-MMM-yyyy")).toBe("28-Feb-2025");
    });
  });

  describe("Payment Terms", () => {
    it("enforces standard Net-15 payment terms specification", () => {
      const termsDays = 15;
      const invoiceDate = new Date("2026-10-01T00:00:00Z");
      const dueDate = new Date(
        invoiceDate.getTime() + termsDays * 24 * 60 * 60 * 1000,
      );

      const diffDays = Math.round(
        (dueDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      assert.strictEqual(diffDays, 15);
      expect(dueDate.toISOString().startsWith("2026-10-16")).toBe(true);
    });
  });
});
