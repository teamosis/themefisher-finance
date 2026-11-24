import { db } from "@/db";
import { reserveWriteRequest } from "@/lib/mcp/write-requests";
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
    [{ requestHash: "hash", completed: true }, "completed"],
    [{ requestHash: "hash", completed: false }, "pending"],
    [{ requestHash: "different", completed: true }, "conflict"],
  ])(
    "matches duplicate requests by their original payload and status",
    async (row, status) => {
      returning.mockResolvedValue([]);
      limit.mockResolvedValue([row]);
      await expect(
        reserveWriteRequest("token", "retry-key", "hash"),
      ).resolves.toBe(status);
    },
  );
});
