import {
  approvePaymentRequest,
  exportPaymentRequestsToScb,
  getPaymentRequestByTrackingCode,
  rejectPaymentRequest,
  submitPaymentRequest,
} from "@/actions/payment-requests";
import { db } from "@/db";
import { verifyPaymentRequest } from "@/lib/payment-request-verification";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { establishBrowserSession } from "../browser-session-fixture";
import { cookieStore } from "../setup";

vi.mock("@/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), execute: vi.fn() },
}));

const requestId = "236fa2ec-e183-44d5-bc7d-904986261b52";
const debitAccountId = "9c37d49a-e515-42a5-ab6d-e57779ddced4";

beforeEach(() => {
  vi.resetAllMocks();
  cookieStore.clear();
});

describe("Public payment requests", () => {
  const form = {
    payeeName: "Example Beneficiary",
    bankName: "Example Bank",
    branchName: "Main",
    routingNumber: "123456789",
    accountNumber: "00123456",
    confirmAccountNumber: "00123456",
    amount: "1250.50",
    purpose: "Monthly service fee",
  };

  it.each(["Infinity", "12.345", "1e3", "0"])(
    "rejects the invalid BDT amount %s before querying the database",
    async (amount) => {
      await expect(
        submitPaymentRequest({ ...form, amount }),
      ).resolves.toMatchObject({ success: false });
      expect(db.select).not.toHaveBeenCalled();
      expect(db.insert).not.toHaveBeenCalled();
    },
  );

  it("requires matching account confirmation", async () => {
    await expect(
      submitPaymentRequest({ ...form, confirmAccountNumber: "00123457" }),
    ).resolves.toMatchObject({ success: false });
    expect(db.select).not.toHaveBeenCalled();
  });

  it("keeps legacy tracking references usable with a status-only projection", async () => {
    const row = {
      trackingCode: "PR-20261124-AB12",
      status: "pending",
      createdAt: new Date(),
      exportedAt: null,
    };
    const limit = vi.fn().mockResolvedValue([row]);
    vi.mocked(db.select).mockReturnValue({
      from: () => ({ where: () => ({ limit }) }),
    } as any);

    await expect(
      getPaymentRequestByTrackingCode(" pr-20261124-ab12 "),
    ).resolves.toEqual(row);
    expect(Object.keys(vi.mocked(db.select).mock.calls[0][0] ?? {})).toEqual([
      "trackingCode",
      "status",
      "createdAt",
      "exportedAt",
    ]);
  });
});

describe("Payment request transitions", () => {
  it("requires a browser session for payout actions", async () => {
    await expect(approvePaymentRequest(requestId)).rejects.toThrow(
      "Authentication required",
    );
    await expect(rejectPaymentRequest(requestId, "Duplicate")).rejects.toThrow(
      "Authentication required",
    );
    await expect(exportPaymentRequestsToScb([requestId])).rejects.toThrow(
      "Authentication required",
    );
    expect(db.update).not.toHaveBeenCalled();
    expect(db.execute).not.toHaveBeenCalled();
  });

  it("stops verification when the request is outside the review queue", async () => {
    vi.mocked(db.select).mockReturnValue({
      from: () => ({ where: () => ({ limit: async () => [] }) }),
    } as any);

    await expect(verifyPaymentRequest(requestId)).rejects.toThrow(
      "Only requests awaiting review",
    );
    expect(db.update).not.toHaveBeenCalled();
  });

  it("stops export when the explicitly selected debit account is missing", async () => {
    await establishBrowserSession();
    vi.mocked(db.select).mockReturnValue({
      from: () => ({ where: () => ({ limit: async () => [] }) }),
    } as any);

    await expect(
      exportPaymentRequestsToScb([requestId], debitAccountId),
    ).rejects.toThrow("No SCB debit account");
    expect(db.execute).not.toHaveBeenCalled();
  });

  it("builds the workbook rows from the requests claimed by the export statement", async () => {
    await establishBrowserSession();
    vi.mocked(db.select).mockReturnValue({
      from: () => ({
        where: () => ({ limit: async () => [{ accountNumber: "00123456" }] }),
      }),
    } as any);
    vi.mocked(db.execute).mockResolvedValue({
      rows: [
        {
          id: requestId,
          customerReference: "PR-20261124-AB12",
          beneficiaryName: "Example Beneficiary",
          accountNumber: "012345",
          routingNumber: "123456789",
          amount: "1250.50",
          reason: "Monthly service fee",
          email: "",
        },
      ],
    } as any);

    const result = await exportPaymentRequestsToScb(
      [requestId, debitAccountId],
      debitAccountId,
    );
    expect(result).toMatchObject({
      count: 1,
      totalAmount: 1250.5,
      exportedIds: [requestId],
    });
    expect(result.rows[0]).toMatchObject({
      "Customer Reference": "PR-20261124-AB12",
      "Beneficiary Account Number": "012345",
      "Debit Account Number(Prefix- 00 BDT)": "00123456",
    });
  });
});
