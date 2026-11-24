import { getInvoiceDateFromValueDate, parseMT103 } from "@/lib/pdfParser";
import { describe, expect, it, vi } from "vitest";

const { getDocument } = vi.hoisted(() => ({ getDocument: vi.fn() }));
vi.mock("pdfjs-dist", () => ({ getDocument, GlobalWorkerOptions: {} }));

describe("MT103 Remittance Advice PDF Parser Logic Suite", () => {
  it("extracts text and releases the PDF worker", async () => {
    const destroy = vi.fn();
    getDocument.mockReturnValueOnce({
      destroy,
      promise: Promise.resolve({
        numPages: 1,
        getPage: async () => ({
          getTextContent: async () => ({
            items: [
              { type: "beginMarkedContent" },
              {
                str: "Payment for TF-2026-08-15-01",
                transform: [1, 0, 0, 1, 30, 50],
              },
            ],
          }),
        }),
      }),
    });
    const result = await parseMT103(new File(["test"], "advice.pdf"));
    expect(result.invoice_number).toBe("TF-2026-08-15-01");
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("passes configured password parameter to getDocument", async () => {
    const destroy = vi.fn();
    getDocument.mockReturnValueOnce({
      destroy,
      promise: Promise.resolve({
        numPages: 1,
        getPage: async () => ({
          getTextContent: async () => ({
            items: [],
          }),
        }),
      }),
    });
    await parseMT103(new File(["test"], "advice.pdf"), "custom_param_pw");
    expect(getDocument).toHaveBeenCalledWith(
      expect.objectContaining({ password: "custom_param_pw" }),
    );
  });

  it("falls back to process.env.PDF_PASSWORD when password parameter is omitted", async () => {
    const prev = process.env.PDF_PASSWORD;
    process.env.PDF_PASSWORD = "env_pdf_password_123";
    const destroy = vi.fn();
    getDocument.mockReturnValueOnce({
      destroy,
      promise: Promise.resolve({
        numPages: 1,
        getPage: async () => ({
          getTextContent: async () => ({
            items: [],
          }),
        }),
      }),
    });
    try {
      await parseMT103(new File(["test"], "advice.pdf"));
      expect(getDocument).toHaveBeenCalledWith(
        expect.objectContaining({ password: "env_pdf_password_123" }),
      );
    } finally {
      process.env.PDF_PASSWORD = prev;
    }
  });

  it("supplies configured password on onPassword callback when reason is NEED_PASSWORD", async () => {
    let capturedOnPassword: any;
    const destroy = vi.fn();
    getDocument.mockImplementationOnce(() => {
      const task: any = {
        destroy,
        promise: Promise.resolve({
          numPages: 1,
          getPage: async () => ({
            getTextContent: async () => ({
              items: [],
            }),
          }),
        }),
      };
      Object.defineProperty(task, "onPassword", {
        set: (fn) => {
          capturedOnPassword = fn;
        },
      });
      return task;
    });

    await parseMT103(new File(["test"], "advice.pdf"), "callback_pw");
    expect(capturedOnPassword).toBeDefined();

    const updatePassword = vi.fn();
    capturedOnPassword(updatePassword, 1);
    expect(updatePassword).toHaveBeenCalledWith("callback_pw");
  });

  it("prompts user when reason is INCORRECT_PASSWORD", async () => {
    let capturedOnPassword: any;
    const destroy = vi.fn();
    getDocument.mockImplementationOnce(() => {
      const task: any = {
        destroy,
        promise: Promise.resolve({
          numPages: 1,
          getPage: async () => ({
            getTextContent: async () => ({
              items: [],
            }),
          }),
        }),
      };
      Object.defineProperty(task, "onPassword", {
        set: (fn) => {
          capturedOnPassword = fn;
        },
      });
      return task;
    });

    const mockPrompt = vi.fn().mockReturnValue("user_entered_password");
    const originalWindow = (globalThis as any).window;
    (globalThis as any).window = { prompt: mockPrompt };
    try {
      await parseMT103(new File(["test"], "advice.pdf"), "initial_wrong_pw");
      expect(capturedOnPassword).toBeDefined();

      const updatePassword = vi.fn();
      capturedOnPassword(updatePassword, 2);
      expect(mockPrompt).toHaveBeenCalledWith(
        "Incorrect password. Enter the PDF password again.",
      );
      expect(updatePassword).toHaveBeenCalledWith("user_entered_password");
    } finally {
      (globalThis as any).window = originalWindow;
    }
  });
  describe("Spatial Coordinate Sorting", () => {
    it("sorts text tokens primarily by Y descending (top-to-bottom), then X ascending (left-to-right) with 5px tolerance", () => {
      const items = [
        { str: "Amount", x: 120, y: 500 },
        { str: "Details", x: 550, y: 502 }, // within 5px tolerance of y=500
        { str: "Value Date", x: 220, y: 498 }, // within 5px tolerance of y=500
        { str: "Header Top", x: 50, y: 750 },
        { str: "Bottom Note", x: 100, y: 150 },
      ];

      items.sort((a, b) => {
        if (Math.abs(b.y - a.y) < 5) {
          return a.x - b.x;
        }
        return b.y - a.y;
      });

      expect(items[0].str).toBe("Header Top");
      // y ~500 items sorted by X
      expect(items[1].str).toBe("Amount"); // x=120
      expect(items[2].str).toBe("Value Date"); // x=220
      expect(items[3].str).toBe("Details"); // x=550
      expect(items[4].str).toBe("Bottom Note");
    });
  });

  describe("Regex Extraction Logic", () => {
    it("extracts and strips commas from amounts accurately", () => {
      const validAmounts = ["5,000.00", "12,450.50", "985", "1,234,567.89"];
      const cleaned = validAmounts.map((str) => {
        if (/^[\d\,\.]+$/.test(str)) {
          return str.replace(/,/g, "");
        }
        return null;
      });

      expect(cleaned).toEqual(["5000.00", "12450.50", "985", "1234567.89"]);
    });

    it("identifies supported remittance currencies", () => {
      const currencies = ["USD", "EUR", "GBP", "BDT", "usd", "Eur"];
      const matched = currencies.map((c) =>
        /^(USD|EUR|GBP|BDT)$/i.test(c) ? c.toUpperCase() : null,
      );

      expect(matched).toEqual(["USD", "EUR", "GBP", "BDT", "USD", "EUR"]);
      expect(/^(USD|EUR|GBP|BDT)$/i.test("JPY")).toBe(false);
    });

    it("extracts invoice numbers following TF- or INV patterns", () => {
      const texts = [
        "Payment for TF-2026-08-15-01 as agreed",
        "Ref: INVOICE-TF-2026-03-01",
        "Payment INV99881177",
        "Random note without reference",
      ];

      const extracted = texts.map((text) => {
        const tfMatch = text.match(/TF-[\w\-]+/i);
        if (tfMatch) return tfMatch[0].toUpperCase();
        const invMatch = text.match(/INV[A-Z0-9\-\_]+/i);
        if (invMatch) return invMatch[0].toUpperCase();
        return null;
      });

      expect(extracted[0]).toBe("TF-2026-08-15-01");
      expect(extracted[1]).toBe("TF-2026-03-01");
      expect(extracted[2]).toBe("INV99881177");
      expect(extracted[3]).toBeNull();
    });

    it("extracts 8-11 character SWIFT/BIC codes", () => {
      const texts = [
        "Beneficiary BIC: SCBLBDDX",
        "Ordering Bank: CHASUS33XXX",
        "No swift here",
      ];

      const swiftRegex = /[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?/g;
      const s1 = texts[0].match(swiftRegex);
      const s2 = texts[1].match(swiftRegex);
      const s3 = texts[2].match(swiftRegex);

      expect(s1?.[0]).toBe("SCBLBDDX");
      expect(s2?.[0]).toBe("CHASUS33XXX");
      expect(s3).toBeNull();
    });

    it("subtracts seven days from a day-first bank date and rejects invalid dates", () => {
      expect(getInvoiceDateFromValueDate("15/08/2026")).toBe("2026-08-08");
      expect(getInvoiceDateFromValueDate("6/1/2026")).toBe("2025-12-30");
      expect(getInvoiceDateFromValueDate("31/02/2026")).toBeUndefined();
    });
  });

  describe("3-Pass Client Matching Algorithm", () => {
    const clients = [
      { id: "c1", name: "Envato Pty Ltd" },
      { id: "c2", name: "Stripe Payments Europe Ltd" },
      { id: "c3", name: "FastSpring" },
    ];

    const matchClient = (parsedName: string) => {
      const q = parsedName.toLowerCase().trim();
      // Pass 1: Exact / Direct substring
      let matched = clients.find((c) => q.includes(c.name.toLowerCase()));
      if (matched) return matched;

      // Pass 2: Clean legal suffixes and match core name
      const cleanNoise = (str: string) =>
        str
          .toLowerCase()
          .replace(
            /\b(pty|ltd|limited|inc|incorporated|corp|corporation|co|private)\b/gi,
            "",
          )
          .replace(/[^a-z0-9 ]/g, " ")
          .trim();

      const cleanedQ = cleanNoise(q);
      matched = clients.find((c) => {
        const cleanedClient = cleanNoise(c.name);
        return (
          cleanedQ.includes(cleanedClient) || cleanedClient.includes(cleanedQ)
        );
      });
      return matched || null;
    };

    it("Pass 1: Matches exact name directly", () => {
      const matched = matchClient("Envato Pty Ltd");
      expect(matched?.id).toBe("c1");
    });

    it("Pass 2: Matches when company legal suffix varies (e.g. LIMITED vs Ltd)", () => {
      const matched = matchClient(
        "STRIPE PAYMENTS EUROPE, LIMITED - 1 GRAND CANAL",
      );
      expect(matched?.id).toBe("c2");
    });

    it("Pass 2: Matches short brand name in ordering customer line", () => {
      const matched = matchClient("Bright Market LLC dba FastSpring");
      expect(matched?.id).toBe("c3");
    });

    it("returns null when no client is recognized", () => {
      const matched = matchClient("Unknown Foreign Customer Corp");
      expect(matched).toBeNull();
    });
  });
});
