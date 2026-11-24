import {
  createPaymentAccount,
  deletePaymentAccount,
  getPaymentAccounts,
} from "@/actions/payment-accounts";
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
    delete: vi.fn(),
  };
  return { db: mockDb };
});

establishBeforeEach(establishBrowserSession);

describe("Payment Accounts Server Actions Suite", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getPaymentAccounts", () => {
    it("returns list of Themefisher receiving bank accounts", async () => {
      const mockAccounts = [
        {
          id: "pa_1",
          bank_name: "Standard Chartered Bank",
          name_on_account: "Themefisher",
          account_number: "0001914137101",
          bic_swift: "SCBLBDDXXXX",
        },
      ];

      const fromMock = vi.fn().mockResolvedValue(mockAccounts);
      vi.mocked(db.select).mockReturnValue({ from: fromMock } as any);

      const result = await getPaymentAccounts();

      expect(db.select).toHaveBeenCalled();
      expect(result).toEqual(mockAccounts);
    });
  });

  describe("createPaymentAccount", () => {
    it("inserts receiving payment account and returns created row", async () => {
      const newAccount = {
        bank_name: "BRAC Bank PLC",
        bank_address: "Gulshan-1, Dhaka",
        name_on_account: "Themefisher",
        account_number: "1501203456789001",
        bic_swift: "BRAKBDDHXXX",
      };

      const createdRow = { id: "pa_new_1", ...newAccount };
      const returningMock = vi.fn().mockResolvedValue([createdRow]);
      const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
      vi.mocked(db.insert).mockReturnValue({ values: valuesMock } as any);

      const result = await createPaymentAccount(newAccount);

      expect(db.insert).toHaveBeenCalled();
      expect(valuesMock).toHaveBeenCalledWith(newAccount);
      expect(result).toEqual(createdRow);
    });
  });

  describe("deletePaymentAccount", () => {
    it("deletes payment account by UUID", async () => {
      const whereMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.delete).mockReturnValue({ where: whereMock } as any);

      await deletePaymentAccount("pa_1");

      expect(db.delete).toHaveBeenCalled();
      expect(whereMock).toHaveBeenCalled();
    });
  });
});
