import {
  createInvoice,
  deleteInvoice,
  getInvoices,
  updateInvoice,
} from "@/actions/invoices";
import { db } from "@/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  return { db: mockDb };
});

describe("Invoices Server Actions Suite", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getInvoices", () => {
    it("returns invoices ordered by createdAt descending", async () => {
      const mockInvoices = [
        { id: "inv_1", invoice_number: "TF-2026-11-24-01", amount: "5000" },
        { id: "inv_2", invoice_number: "TF-2026-11-20-01", amount: "2500" },
      ];

      const orderByMock = vi.fn().mockResolvedValue(mockInvoices);
      const fromMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
      vi.mocked(db.select).mockReturnValue({ from: fromMock } as any);

      const result = await getInvoices();

      expect(db.select).toHaveBeenCalled();
      expect(result).toEqual(mockInvoices);
    });
  });

  describe("createInvoice", () => {
    it("inserts invoice data and returns created row", async () => {
      const newInvoice = {
        client_id: "client_123",
        invoice_number: "TF-2026-11-24-02",
        invoice_date: "2026-11-24",
        amount: 4500,
        currency: "USD",
        description: "Web development services",
      };

      const createdRow = { id: "inv_new_123", ...newInvoice };
      const returningMock = vi.fn().mockResolvedValue([createdRow]);
      const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
      vi.mocked(db.insert).mockReturnValue({ values: valuesMock } as any);

      const result = await createInvoice(newInvoice);

      expect(db.insert).toHaveBeenCalled();
      expect(valuesMock).toHaveBeenCalledWith(newInvoice);
      expect(result).toEqual(createdRow);
    });
  });

  describe("updateInvoice", () => {
    it("updates invoice fields while stripping createdAt to prevent overwrite", async () => {
      const updateData = {
        amount: 4800,
        description: "Updated service description",
        createdAt: new Date("2020-01-01"), // smuggled createdAt should be ignored
      };

      const updatedRow = {
        id: "inv_123",
        amount: 4800,
        description: "Updated service description",
      };

      const returningMock = vi.fn().mockResolvedValue([updatedRow]);
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
      const setMock = vi.fn().mockReturnValue({ where: whereMock });
      vi.mocked(db.update).mockReturnValue({ set: setMock } as any);

      const result = await updateInvoice("inv_123", updateData as any);

      expect(db.update).toHaveBeenCalled();
      // Ensure createdAt was explicitly set to undefined
      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 4800,
          description: "Updated service description",
          createdAt: undefined,
        }),
      );
      expect(result).toEqual(updatedRow);
    });
  });

  describe("deleteInvoice", () => {
    it("deletes invoice by UUID", async () => {
      const whereMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.delete).mockReturnValue({ where: whereMock } as any);

      await deleteInvoice("inv_123");

      expect(db.delete).toHaveBeenCalled();
      expect(whereMock).toHaveBeenCalled();
    });
  });
});
