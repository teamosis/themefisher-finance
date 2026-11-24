import { invoiceAmount, invoiceCurrency } from "@/lib/invoice-validation";
import { extractMT103Text, getInvoiceDateFromValueDate } from "@/lib/mt103-text";
import { z } from "zod";
import { McpToolError } from "./tool-definition";

const maxBytes = 180 * 1024;

export const remittancePdfFields = z.object({
  pdfBase64: z.string().max(4 * Math.ceil(maxBytes / 3)).pipe(z.base64()),
  password: z.string().max(256).optional().describe("Password for this file if it differs from the configured password."),
});

export async function parseRemittancePdf({ pdfBase64, password }: z.infer<typeof remittancePdfFields>) {
  const pdf = Buffer.from(pdfBase64, "base64");
  if (pdf.length > maxBytes || !pdf.subarray(0, 8).toString("ascii").startsWith("%PDF-")) {
    throw new McpToolError("Provide a PDF of up to 180 KiB as Base64.");
  }

  const { getDocument, PasswordResponses, VerbosityLevel } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  try {
    const document = getDocument({
      data: new Uint8Array(pdf),
      password: password ?? process.env.PDF_PASSWORD,
      useWorkerFetch: false,
      disableFontFace: true,
      useSystemFonts: false,
      stopAtErrors: true,
      verbosity: VerbosityLevel.ERRORS,
    });
    const result = await extractMT103Text(document, { pages: 10, characters: 200_000 });
    const amount = invoiceAmount.safeParse(Number(result.amount)).data;
    const currency = invoiceCurrency.safeParse(result.currency).data;
    const invoiceDate = getInvoiceDateFromValueDate(result.value_date);
    if (!amount || !currency || !invoiceDate) {
      throw new McpToolError("The PDF does not contain the required MT103 amount, currency, and value date. Review the source document.");
    }

    return {
      draft: {
        amount,
        receivedAmount: amount,
        currency,
        invoiceDate,
        invoiceNumber: result.invoice_number || undefined,
      },
      orderingCustomer: result.client_name || undefined,
      swiftCode: result.swift_code || undefined,
      valueDate: result.value_date,
    };
  } catch (err) {
    if (err instanceof McpToolError) throw err;
    if (err instanceof Error && err.name === "PasswordException") {
      const code = "code" in err ? err.code : undefined;
      throw new McpToolError(code === PasswordResponses.INCORRECT_PASSWORD
        ? "The PDF password was incorrect. Provide the correct file password."
        : "The PDF is encrypted. Provide its password.");
    }
    throw new McpToolError("The PDF could not be read within the MT103 size and page limits.");
  }
}
