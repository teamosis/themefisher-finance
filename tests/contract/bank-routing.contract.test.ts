import assert from "node:assert";
import { describe, expect, it } from "vitest";

describe("Bangladesh Bank BEFTN Routing & SWIFT Contract Suite", () => {
  describe("Routing Number Validation", () => {
    it("validates 9-digit numeric Bangladesh Bank BEFTN routing code", () => {
      const validRoutingCodes = [
        "090271234",
        "215260987",
        "150261122",
        "000000001",
      ];
      const routingPattern = /^\d{9}$/;

      for (const code of validRoutingCodes) {
        expect(code).toMatch(routingPattern);
        expect(code).toHaveLength(9);
      }

      const invalidRoutingCodes = [
        "09027123", // 8 digits
        "0902712345", // 10 digits
        "09027ABCD", // alphanumeric
        "",
      ];
      for (const code of invalidRoutingCodes) {
        expect(code).not.toMatch(routingPattern);
      }
    });
  });

  describe("SWIFT / BIC Code Validation and Country Code Extraction", () => {
    it("validates 8 and 11 character SWIFT/BIC codes", () => {
      const validSwifts = [
        "SCBLBDDX", // 8 chars (Bangladesh)
        "SCBLBDDXXXX", // 11 chars
        "CHASUS33", // 8 chars (US)
        "CHASUS33XXX", // 11 chars
        "BARCGB22", // 8 chars (UK)
      ];

      const swiftPattern = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

      for (const swift of validSwifts) {
        expect(swift).toMatch(swiftPattern);
      }

      expect("INVALID").not.toMatch(swiftPattern);
      expect("12345678").not.toMatch(swiftPattern);
    });

    it("extracts 2-letter ISO country code from SWIFT code (positions 5-6)", () => {
      const extractCountry = (swift: string) => {
        if (!swift || swift.length < 8) return null;
        return swift.substring(4, 6).toUpperCase();
      };

      expect(extractCountry("SCBLBDDX")).toBe("BD"); // Bangladesh
      expect(extractCountry("CHASUS33XXX")).toBe("US"); // United States
      expect(extractCountry("BARCGB22")).toBe("GB"); // Great Britain
      expect(extractCountry("DEUTDEDD")).toBe("DE"); // Germany
      expect(extractCountry("SHORT")).toBeNull();
    });
  });
});
