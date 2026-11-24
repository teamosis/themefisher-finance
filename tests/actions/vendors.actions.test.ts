import {
  createVendor,
  deleteVendor,
  getVendors,
  updateVendor,
} from "@/actions/vendors";
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

describe("Vendors & Beneficiaries Server Actions Suite", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getVendors", () => {
    it("returns list of vendors and employees", async () => {
      const mockVendors = [
        {
          id: "v1",
          receiver_name: "Rahim Ahmed",
          account_number: "1152203498001",
          bank_name: "Dutch-Bangla Bank PLC",
          branch_name: "Dhanmondi Branch",
          routing_number: "090271234",
          is_employee: true,
          salary: "65000",
          is_hidden: false,
        },
      ];

      const fromMock = vi.fn().mockResolvedValue(mockVendors);
      vi.mocked(db.select).mockReturnValue({ from: fromMock } as any);

      const result = await getVendors();

      expect(db.select).toHaveBeenCalled();
      expect(result).toEqual(mockVendors);
    });
  });

  describe("createVendor", () => {
    it("inserts vendor with bank account and routing number", async () => {
      const newVendor = {
        receiver_name: "Tariq Hasan",
        account_number: "1501209876543001",
        bank_name: "BRAC Bank PLC",
        branch_name: "Gulshan Branch",
        routing_number: "060261234",
        is_employee: true,
        salary: "80000",
      };

      const createdRow = { id: "v_new_1", ...newVendor };
      const returningMock = vi.fn().mockResolvedValue([createdRow]);
      const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
      vi.mocked(db.insert).mockReturnValue({ values: valuesMock } as any);

      const result = await createVendor(newVendor);

      expect(db.insert).toHaveBeenCalled();
      expect(valuesMock).toHaveBeenCalledWith(newVendor);
      expect(result).toEqual(createdRow);
    });
  });

  describe("updateVendor", () => {
    it("updates vendor details and supports soft archiving (is_hidden: true)", async () => {
      const updateData = {
        is_hidden: true,
        salary: "85000",
        createdAt: new Date(),
      };

      const updatedRow = { id: "v1", is_hidden: true, salary: "85000" };
      const returningMock = vi.fn().mockResolvedValue([updatedRow]);
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
      const setMock = vi.fn().mockReturnValue({ where: whereMock });
      vi.mocked(db.update).mockReturnValue({ set: setMock } as any);

      const result = await updateVendor("v1", updateData as any);

      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({
          is_hidden: true,
          salary: "85000",
          createdAt: undefined,
        }),
      );
      expect(result).toEqual(updatedRow);
    });
  });

  describe("deleteVendor", () => {
    it("deletes vendor permanently by UUID", async () => {
      const whereMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.delete).mockReturnValue({ where: whereMock } as any);

      await deleteVendor("v1");

      expect(db.delete).toHaveBeenCalled();
      expect(whereMock).toHaveBeenCalled();
    });
  });
});
