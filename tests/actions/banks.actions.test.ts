import {
  getBankNames,
  getBranchesByBank,
  getRoutingNumber,
  lookupSwiftCode,
} from "@/actions/banks";
import { db } from "@/db";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => {
  const mockDb = {
    selectDistinct: vi.fn(),
    select: vi.fn(),
  };
  return { db: mockDb };
});

describe("Bank & Branch Routing Server Actions Suite", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe("getBankNames", () => {
    it("returns distinct bank names sorted alphabetically", async () => {
      const mockBanks = [
        { bankName: "Bank Asia PLC" },
        { bankName: "BRAC Bank PLC" },
        { bankName: "Dutch-Bangla Bank PLC" },
        { bankName: "Standard Chartered Bank" },
      ];

      const orderByMock = vi.fn().mockResolvedValue(mockBanks);
      const fromMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
      vi.mocked(db.selectDistinct).mockReturnValue({ from: fromMock } as any);

      const result = await getBankNames();

      expect(result).toEqual([
        "Bank Asia PLC",
        "BRAC Bank PLC",
        "Dutch-Bangla Bank PLC",
        "Standard Chartered Bank",
      ]);
    });
  });

  describe("getBranchesByBank", () => {
    it("returns branches and districts for the specified bank name", async () => {
      const mockBranches = [
        { branchName: "Dhanmondi Branch", districtName: "Dhaka" },
        { branchName: "Gulshan Branch", districtName: "Dhaka" },
      ];

      const orderByMock = vi.fn().mockResolvedValue(mockBranches);
      const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      vi.mocked(db.select).mockReturnValue({ from: fromMock } as any);

      const result = await getBranchesByBank("Standard Chartered Bank");

      expect(result).toEqual(mockBranches);
    });
  });

  describe("getRoutingNumber", () => {
    it("queries single 9-digit routing number for bank and branch pair", async () => {
      const limitMock = vi
        .fn()
        .mockResolvedValue([{ routingNumber: "215260987" }]);
      const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      vi.mocked(db.select).mockReturnValue({ from: fromMock } as any);

      const result = await getRoutingNumber(
        "Standard Chartered Bank",
        "Gulshan Branch",
      );

      expect(result).toBe("215260987");
    });
  });

  describe("lookupSwiftCode", () => {
    it("queries external SWIFT registry and returns bank details on match", async () => {
      const mockApiResponse = [
        {
          swift_code: "SCBLBDDX",
          bank: "STANDARD CHARTERED BANK",
          branch: "DHAKA MAIN BRANCH",
          city: "DHAKA",
        },
      ];

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      } as Response);

      const result = await lookupSwiftCode("SCBLBDDX");

      expect(result).toEqual({
        bank_name: "STANDARD CHARTERED BANK",
        branch: "DHAKA MAIN BRANCH",
        city: "DHAKA",
        country: "BD",
      });
    });

    it("returns null when SWIFT code is too short (< 8 chars)", async () => {
      const result = await lookupSwiftCode("SHORT");
      expect(result).toBeNull();
    });

    it("returns null gracefully on network failure or 404 response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await lookupSwiftCode("UNKNOWNXX");
      expect(result).toBeNull();
    });
  });
});
