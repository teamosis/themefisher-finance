import assert from "node:assert";
import { describe, expect, it } from "vitest";

describe("MT103 Remittance Advice PDF Parser Logic Suite", () => {
  describe("Spatial Coordinate Sorting", () => {
    it("sorts text tokens primarily by Y descending (top-to-bottom), then X ascending (left-to-right) with 5px tolerance", () => {
      const items = [
        { str: "Amount", x: 120, y: 500 },
        { str: "Details", x: 550, y: 502 }, // within 5px tolerance of y=500
        { str: "Value Date", x: 220, y: 498 }, // within 5px tolerance of y=500
        { str: "Header Top", x: 50, y: 750 },
        { str: "Bottom Note", x: 100, y: 150 },
      ];

      items.sort((a, b) => {
        if (Math.abs(b.y - a.y) < 5) {
          return a.x - b.x;
        }
        return b.y - a.y;
      });

      expect(items[0].str).toBe("Header Top");
      // y ~500 items sorted by X
      expect(items[1].str).toBe("Amount"); // x=120
      expect(items[2].str).toBe("Value Date"); // x=220
      expect(items[3].str).toBe("Details"); // x=550
      expect(items[4].str).toBe("Bottom Note");
    });
  });

  describe("Regex Extraction Logic", () => {
    it("extracts and strips commas from amounts accurately", () => {
      const validAmounts = ["5,000.00", "12,450.50", "985", "1,234,567.89"];
      const cleaned = validAmounts.map((str) => {
        if (/^[\d\,\.]+$/.test(str)) {
          return str.replace(/,/g, "");
        }
        return null;
      });

      expect(cleaned).toEqual(["5000.00", "12450.50", "985", "1234567.89"]);
    });

    it("identifies supported remittance currencies", () => {
      const currencies = ["USD", "EUR", "GBP", "BDT", "usd", "Eur"];
      const matched = currencies.map((c) =>
        /^(USD|EUR|GBP|BDT)$/i.test(c) ? c.toUpperCase() : null,
      );

      expect(matched).toEqual(["USD", "EUR", "GBP", "BDT", "USD", "EUR"]);
      expect(/^(USD|EUR|GBP|BDT)$/i.test("JPY")).toBe(false);
    });

    it("extracts invoice numbers following TF- or INV patterns", () => {
      const texts = [
        "Payment for TF-2026-08-15-01 as agreed",
        "Ref: INVOICE-TF-2026-03-01",
        "Payment INV99881177",
        "Random note without reference",
      ];

      const extracted = texts.map((text) => {
        const tfMatch = text.match(/TF-[\w\-]+/i);
        if (tfMatch) return tfMatch[0].toUpperCase();
        const invMatch = text.match(/INV[A-Z0-9\-\_]+/i);
        if (invMatch) return invMatch[0].toUpperCase();
        return null;
      });

      expect(extracted[0]).toBe("TF-2026-08-15-01");
      expect(extracted[1]).toBe("TF-2026-03-01");
      expect(extracted[2]).toBe("INV99881177");
      expect(extracted[3]).toBeNull();
    });

    it("extracts 8-11 character SWIFT/BIC codes", () => {
      const texts = [
        "Beneficiary BIC: SCBLBDDX",
        "Ordering Bank: CHASUS33XXX",
        "No swift here",
      ];

      const swiftRegex = /[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?/g;
      const s1 = texts[0].match(swiftRegex);
      const s2 = texts[1].match(swiftRegex);
      const s3 = texts[2].match(swiftRegex);

      expect(s1?.[0]).toBe("SCBLBDDX");
      expect(s2?.[0]).toBe("CHASUS33XXX");
      expect(s3).toBeNull();
    });

    it("computes invoice date as Value Date minus 7 days", () => {
      const valueDateStr = "15/08/2026";
      const parts = valueDateStr.split("/");
      const valDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);

      valDate.setDate(valDate.getDate() - 7);
      const invoiceDateStr = valDate.toISOString().split("T")[0];

      expect(invoiceDateStr).toBe("2026-08-08");
    });
  });

  describe("3-Pass Client Matching Algorithm", () => {
    const clients = [
      { id: "c1", name: "Envato Pty Ltd" },
      { id: "c2", name: "Stripe Payments Europe Ltd" },
      { id: "c3", name: "FastSpring" },
    ];

    const matchClient = (parsedName: string) => {
      const q = parsedName.toLowerCase().trim();
      // Pass 1: Exact / Direct substring
      let matched = clients.find((c) => q.includes(c.name.toLowerCase()));
      if (matched) return matched;

      // Pass 2: Clean legal suffixes and match core name
      const cleanNoise = (str: string) =>
        str
          .toLowerCase()
          .replace(/\b(pty|ltd|limited|inc|incorporated|corp|corporation|co|private)\b/gi, "")
          .replace(/[^a-z0-9 ]/g, " ")
          .trim();

      const cleanedQ = cleanNoise(q);
      matched = clients.find((c) => {
        const cleanedClient = cleanNoise(c.name);
        return cleanedQ.includes(cleanedClient) || cleanedClient.includes(cleanedQ);
      });
      return matched || null;
    };

    it("Pass 1: Matches exact name directly", () => {
      const matched = matchClient("Envato Pty Ltd");
      expect(matched?.id).toBe("c1");
    });

    it("Pass 2: Matches when company legal suffix varies (e.g. LIMITED vs Ltd)", () => {
      const matched = matchClient("STRIPE PAYMENTS EUROPE, LIMITED - 1 GRAND CANAL");
      expect(matched?.id).toBe("c2");
    });

    it("Pass 2: Matches short brand name in ordering customer line", () => {
      const matched = matchClient("Bright Market LLC dba FastSpring");
      expect(matched?.id).toBe("c3");
    });

    it("returns null when no client is recognized", () => {
      const matched = matchClient("Unknown Foreign Customer Corp");
      expect(matched).toBeNull();
    });
  });
});
