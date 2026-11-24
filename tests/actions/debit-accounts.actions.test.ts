import {
  createDebitAccount,
  deleteDebitAccount,
  getDebitAccounts,
  setDefaultDebitAccount,
} from "@/actions/debit-accounts";
import { db } from "@/db";
import {
  afterEach,
  describe,
  beforeEach as establishBeforeEach,
  expect,
  it,
  vi,
} from "vitest";
import { establishBrowserSession } from "../browser-session-fixture";

vi.mock("@/db", () => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
    batch: vi.fn(),
  };
  return { db: mockDb };
});

establishBeforeEach(establishBrowserSession);

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
      const valuesMock = vi.fn().mockReturnValue({ returning: vi.fn() });
      vi.mocked(db.insert).mockReturnValue({ values: valuesMock } as any);
      vi.mocked(db.batch).mockResolvedValueOnce([{}, [createdRow]] as any);

      const result = await createDebitAccount(newAccount);

      expect(db.insert).toHaveBeenCalled();
      expect(result).toEqual(createdRow);
    });
  });

  describe("setDefaultDebitAccount", () => {
    it("locks the account table and switches both defaults in one transaction", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: () => ({ where: vi.fn() }),
      } as any);
      const set = vi
        .fn()
        .mockReturnValue({ where: () => ({ returning: vi.fn() }) });
      vi.mocked(db.update).mockReturnValue({ set } as any);
      vi.mocked(db.batch).mockResolvedValueOnce([
        {},
        {},
        [{ id: "da_1" }],
      ] as any);

      await setDefaultDebitAccount("da_1");
      expect(db.execute).toHaveBeenCalledOnce();
      expect(db.batch).toHaveBeenCalledOnce();
      expect(set).toHaveBeenNthCalledWith(1, { is_default: false });
      expect(set).toHaveBeenNthCalledWith(2, { is_default: true });
    });
  });

  describe("deleteDebitAccount", () => {
    it("deletes debit account by UUID", async () => {
      const whereMock = vi.fn().mockReturnValue({ returning: vi.fn() });
      vi.mocked(db.batch).mockResolvedValueOnce([{}, [{ id: "da_1" }]] as any);
      vi.mocked(db.delete).mockReturnValue({ where: whereMock } as any);

      await deleteDebitAccount("da_1");

      expect(db.delete).toHaveBeenCalled();
      expect(whereMock).toHaveBeenCalled();
    });
  });
});
