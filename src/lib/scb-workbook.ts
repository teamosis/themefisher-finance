import { format, isValid, parseISO } from "date-fns";

interface ScbPayee {
  customerReference?: string;
  beneficiaryName: string;
  accountNumber: string;
  routingNumber: string;
  amount: string;
  reason?: string;
  email?: string;
}

export function scbWorkbookRow(payee: ScbPayee, paymentDate: string, debitAccount: string) {
  return {
    "Customer Reference": payee.customerReference ?? "",
    "Beneficiary Name(120)": payee.beneficiaryName,
    "Beneficiary Account Number": payee.accountNumber,
    "Routing Number": payee.routingNumber,
    "Payment Amount": payee.amount,
    "Reason(140)": payee.reason ?? "",
    "Date(DD/MM/YYYY)": paymentDate,
    "Debit Account Number(Prefix- 00 BDT)": debitAccount.trim(),
    "Beneficiary Email ID(Optional)": payee.email ?? "",
  };
}

export function isPaymentAmount(value: string) {
  return /^\d+(?:\.\d{1,2})?$/.test(value) && Number.isFinite(Number(value)) && Number(value) > 0;
}

export function formatTransferDate(value: string) {
  const date = parseISO(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(date)
    ? format(date, "dd/MM/yyyy")
    : undefined;
}

export async function buildScbWorkbook(rows: Record<string, string>[], sheetName: string) {
  const xlsx = await import("xlsx");
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(rows), sheetName);
  return { xlsx, workbook };
}
