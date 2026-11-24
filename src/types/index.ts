// ==========================================
// Invoice & Form-C Tool Types
// ==========================================
export interface Client {
  id: string;
  name: string;
  address: string;
  tax_id?: string;
  bank_name: string;
  bank_address: string;
  created_at?: string;
}

export interface ClientFormData {
  name: string;
  address: string;
  tax_id?: string;
  bank_name: string;
  bank_address: string;
}

export interface PaymentAccount {
  id: string;
  bank_name: string;
  bank_address?: string;
  name_on_account: string;
  bic_swift?: string;
  account_number: string;
  account_name?: string;
  account_details?: string;
  created_at?: string;
}

export interface PaymentAccountFormData {
  bank_name: string;
  bank_address?: string;
  name_on_account: string;
  bic_swift?: string;
  account_number: string;
}

export interface Invoice {
  id: string;
  client_id: string;
  invoice_number: string;
  invoice_date: string;
  currency?: string;
  amount: number;
  description: string;
  received_amount: number;
  payment_methods: string[];
  created_at?: string;
}

export interface InvoiceFormData {
  client_id: string;
  invoice_number: string;
  invoice_date: string;
  currency?: string;
  amount: string | number;
  description: string;
  received_amount?: string | number;
  payment_methods?: string | string[];
}

// ==========================================
// SCB Bulk Transaction Tool Types
// ==========================================
export interface Vendor {
  id: string;
  receiver_name: string;
  account_number: string;
  bank_name: string;
  branch_name: string;
  routing_number: string;
  is_employee?: boolean;
  is_hidden?: boolean | null;
  salary?: number | string;
  created_at?: string;
}

export interface DebitAccount {
  id: string;
  account_number: string;
  account_label: string;
  bank_name: string;
  is_default: boolean;
  created_at?: string;
}

// ==========================================
// App Activity Log Types
// ==========================================
export type ActivityDomain =
  | "scb_tools"
  | "invoice_tools"
  | "settings"
  | "auth";

export type ActivityAction =
  | "excel_export_transfers"
  | "excel_export_salary"
  | "invoice_create"
  | "invoice_update"
  | "invoice_delete"
  | "vendor_create"
  | "vendor_update"
  | "vendor_archive"
  | "vendor_restore"
  | "vendor_delete"
  | "debit_account_create"
  | "debit_account_update"
  | "debit_account_delete"
  | "client_create"
  | "client_update"
  | "client_delete"
  | "payment_account_create"
  | "payment_account_delete"
  | "pdf_parsed"
  | "login"
  | "logout";

export interface ActivityExcelItem {
  beneficiaryName: string;
  accountNumber: string;
  bankName?: string;
  branchName?: string;
  routingNumber: string;
  amount: string;
  reason?: string;
  isEmployee?: boolean;
}

export interface ActivityLogDetails {
  fileName?: string;
  sheetName?: string;
  totalAmount?: number | string;
  currency?: string;
  itemCount?: number;
  debitAccount?: string;
  reason?: string;
  items?: ActivityExcelItem[];
  changes?: Record<string, { from: any; to: any }>;
  extra?: Record<string, any>;
}

export interface ActivityLog {
  id: string;
  domain: ActivityDomain;
  action: ActivityAction;
  entityType?: string | null;
  entityId?: string | null;
  title: string;
  details?: ActivityLogDetails | null;
  status: "success" | "failed" | "warning";
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string | Date;
}

export interface ActivityLogStats {
  totalActivities: number;
  totalExcelExports: number;
  totalPayoutAmount: number;
  totalInvoices: number;
  totalVendorChanges: number;
}


