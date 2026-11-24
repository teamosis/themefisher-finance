import { db } from "@/db";
import { compactWriteReceipt, reserveWriteRequest } from "@/lib/mcp/write-requests";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: { insert: vi.fn(), select: vi.fn() } }));

describe("MCP write reservations", () => {
  const returning = vi.fn();
  const limit = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(db.insert).mockReturnValue({
      values: () => ({ onConflictDoNothing: () => ({ returning }) }),
    } as any);
    vi.mocked(db.select).mockReturnValue({
      from: () => ({ where: () => ({ limit }) }),
    } as any);
  });

  it("grants a new reservation without querying for an existing row", async () => {
    returning.mockResolvedValue([{ key: "retry-key" }]);
    await expect(
      reserveWriteRequest("token", "retry-key", "hash"),
    ).resolves.toBe("reserved");
    expect(db.select).not.toHaveBeenCalled();
  });

  it.each([
    [{ requestHash: "hash", completed: true }, { status: "completed", receipt: null }],
    [{ requestHash: "hash", completed: true, receipt: { id: "request-id" } }, { status: "completed", receipt: { id: "request-id" } }],
    [{ requestHash: "hash", completed: false }, "pending"],
    [{ requestHash: "different", completed: true }, "conflict"],
  ])(
    "matches duplicate requests by their original payload and status",
    async (row, status) => {
      returning.mockResolvedValue([]);
      limit.mockResolvedValue([row]);
      await expect(
        reserveWriteRequest("token", "retry-key", "hash"),
      ).resolves.toEqual(status);
    },
  );

  it("keeps references and omits workbook bytes and bank data", () => {
    const receipt = compactWriteReceipt({
      fileName: "export.xlsx",
      exportedIds: ["request-id"],
      xlsxBase64: "workbook",
      vendor: { id: "vendor-id", account_number: "dummy-account" },
    });
    expect(receipt).toEqual({
      fileName: "export.xlsx", exportedIds: ["request-id"], vendor: { id: "vendor-id" },
    });
  });
});
