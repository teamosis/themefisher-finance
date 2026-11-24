import { z } from "zod";

export const invoiceDate = z.iso.date();
export const invoiceCurrency = z.enum([
  "USD",
  "BDT",
  "GBP",
  "EUR",
  "CAD",
  "AUD",
  "CHF",
]);
export const invoiceAmount = z
  .number()
  .positive()
  .refine(
    (amount) => /^\d+(?:\.\d{1,2})?$/.test(String(amount)),
    "Invoice amounts must use at most two decimal places",
  );

const paymentReference = z.union([
  z.uuid(),
  z.literal("Wire Transfer"),
  z.literal("Bank Remittance"),
]);

export const invoicePaymentMethods = z.array(paymentReference);

export const invoiceFields = z.object({
  invoice_date: invoiceDate.nullish(),
  currency: invoiceCurrency.nullish(),
  amount: z.coerce.number().pipe(invoiceAmount).nullish(),
  received_amount: z
    .union([z.literal(0), z.coerce.number().pipe(invoiceAmount)])
    .nullish(),
  payment_methods: z.union([invoicePaymentMethods, paymentReference]).nullish(),
});
