import {
  createDebitAccount,
  deleteDebitAccount,
  getDebitAccounts,
  setDefaultDebitAccount,
  unsetAllDefaultDebitAccounts,
  updateDebitAccount,
} from "@/actions/debit-accounts";
import { db } from "@/db";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  return { db: mockDb };
});

describe("Debit Accounts Server Actions Suite", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getDebitAccounts", () => {
    it("returns list of SCB debit funding accounts", async () => {
      const mockAccounts = [
        {
          id: "da_1",
          account_number: "0001914137101",
          account_label: "Main SCB Account",
          bank_name: "Standard Chartered Bank",
          is_default: true,
        },
      ];

      const fromMock = vi.fn().mockResolvedValue(mockAccounts);
      vi.mocked(db.select).mockReturnValue({ from: fromMock } as any);

      const result = await getDebitAccounts();

      expect(db.select).toHaveBeenCalled();
      expect(result).toEqual(mockAccounts);
    });
  });

  describe("createDebitAccount", () => {
    it("creates a new debit account", async () => {
      const newAccount = {
        account_number: "0001914137102",
        account_label: "Secondary SCB Account",
        bank_name: "Standard Chartered Bank",
        is_default: false,
      };

      const createdRow = { id: "da_new_1", ...newAccount };
      const returningMock = vi.fn().mockResolvedValue([createdRow]);
      const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
      vi.mocked(db.insert).mockReturnValue({ values: valuesMock } as any);

      const result = await createDebitAccount(newAccount);

      expect(db.insert).toHaveBeenCalled();
      expect(result).toEqual(createdRow);
    });
  });

  describe("setDefaultDebitAccount", () => {
    it("atomically unsets all existing defaults before setting chosen account as default", async () => {
      // 1. unsetAll call: db.update(debitAccounts).set({ is_default: false })
      const setMock1 = vi.fn().mockResolvedValue(undefined);
      // 2. set target call: db.update(debitAccounts).set({ is_default: true }).where(eq(...)).returning()
      const returningMock = vi.fn().mockResolvedValue([
        { id: "da_2", is_default: true },
      ]);
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
      const setMock2 = vi.fn().mockReturnValue({ where: whereMock });

      vi.mocked(db.update)
        .mockReturnValueOnce({ set: setMock1 } as any)
        .mockReturnValueOnce({ set: setMock2 } as any);

      await setDefaultDebitAccount("da_2");

      expect(db.update).toHaveBeenCalledTimes(2);
      expect(setMock1).toHaveBeenCalledWith({ is_default: false });
      expect(setMock2).toHaveBeenCalledWith({ is_default: true });
    });
  });

  describe("deleteDebitAccount", () => {
    it("deletes debit account by UUID", async () => {
      const whereMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.delete).mockReturnValue({ where: whereMock } as any);

      await deleteDebitAccount("da_1");

      expect(db.delete).toHaveBeenCalled();
      expect(whereMock).toHaveBeenCalled();
    });
  });
});
