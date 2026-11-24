import {
  createClient,
  deleteClient,
  getClients,
  updateClient,
} from "@/actions/clients";
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

describe("Clients Server Actions Suite", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getClients", () => {
    it("returns clients ordered alphabetically by name", async () => {
      const mockClients = [
        { id: "c1", name: "Envato Pty Ltd" },
        { id: "c2", name: "FastSpring" },
        { id: "c3", name: "Stripe Payments Europe Ltd" },
      ];

      const orderByMock = vi.fn().mockResolvedValue(mockClients);
      const fromMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
      vi.mocked(db.select).mockReturnValue({ from: fromMock } as any);

      const result = await getClients();

      expect(db.select).toHaveBeenCalled();
      expect(result).toEqual(mockClients);
    });
  });

  describe("createClient", () => {
    it("inserts client and returns created client record", async () => {
      const clientData = {
        name: "Acme Corp",
        address: "123 Main St, Sydney, Australia",
        tax_id: "AU12345678",
        bank_name: "ANZ Bank",
        bank_address: "Sydney Branch",
      };

      const createdRow = { id: "c_new_123", ...clientData };
      const returningMock = vi.fn().mockResolvedValue([createdRow]);
      const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
      vi.mocked(db.insert).mockReturnValue({ values: valuesMock } as any);

      const result = await createClient(clientData);

      expect(db.insert).toHaveBeenCalled();
      expect(valuesMock).toHaveBeenCalledWith(clientData);
      expect(result).toEqual(createdRow);
    });
  });

  describe("updateClient", () => {
    it("updates client fields while stripping createdAt", async () => {
      const updateData = {
        address: "456 High St, Melbourne, Australia",
        createdAt: new Date(),
      };

      const updatedRow = { id: "c1", name: "Acme", address: updateData.address };
      const returningMock = vi.fn().mockResolvedValue([updatedRow]);
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
      const setMock = vi.fn().mockReturnValue({ where: whereMock });
      vi.mocked(db.update).mockReturnValue({ set: setMock } as any);

      const result = await updateClient("c1", updateData as any);

      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({
          address: updateData.address,
          createdAt: undefined,
        }),
      );
      expect(result).toEqual(updatedRow);
    });
  });

  describe("deleteClient", () => {
    it("deletes client by ID", async () => {
      const whereMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.delete).mockReturnValue({ where: whereMock } as any);

      await deleteClient("c1");

      expect(db.delete).toHaveBeenCalled();
      expect(whereMock).toHaveBeenCalled();
    });
  });
});
