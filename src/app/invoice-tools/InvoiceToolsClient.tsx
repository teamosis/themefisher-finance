"use client";
import { getClients, getPdfPassword, lookupSwiftCode } from "@/actions";
import { BankInvoice } from "@/components/documents/BankInvoice";
import { CForm } from "@/components/documents/CForm";
import SearchableClientSelect from "@/components/forms/SearchableClientSelect";
import { CreateClientModal } from "@/components/modals/CreateClientModal";
import { CreateInvoiceModal } from "@/components/modals/CreateInvoiceModal";
import { Modal } from "@/components/modals/Modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getInvoiceDateFromValueDate, parseMT103 } from "@/lib/pdfParser";
import type { Client, Invoice, PaymentAccount } from "@/types";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileText,
  Loader2,
  Printer,
  UploadCloud,
  X,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";

type ViewTab = "all" | "invoice" | "cform";

export default function InvoiceToolsClient({
  initialClients,
  initialInvoices,
  initialPaymentAccounts,
  pdfPassword,
}: {
  initialClients: Client[];
  initialInvoices: Invoice[];
  initialPaymentAccounts: PaymentAccount[];
  pdfPassword?: string;
}) {
  const searchParams = useSearchParams();
  const queryInvoiceId = searchParams.get("invoiceId");

  const [clients, setClients] = useState<Client[]>(initialClients);
  const [invoices] = useState<Invoice[]>(initialInvoices);
  const [paymentAccounts] = useState<PaymentAccount[]>(initialPaymentAccounts);

  const matchedInv = queryInvoiceId
    ? initialInvoices.find((i) => i.id === queryInvoiceId)
    : null;
  const [selectedClientId, setSelectedClientId] = useState(
    matchedInv ? matchedInv.client_id : "",
  );
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(
    matchedInv ? matchedInv.id : "",
  );

  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [isCreateClientModalOpen, setIsCreateClientModalOpen] = useState(false);
  const [clientDefaultValues, setClientDefaultValues] = useState<any>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [matchPopupData, setMatchPopupData] = useState<{
    invoiceNum: string;
    clientName: string;
  } | null>(null);

  const triggerError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 6000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPdf(true);
    try {
      let resolvedPassword = pdfPassword;
      if (!resolvedPassword) {
        try {
          resolvedPassword = await getPdfPassword();
        } catch {
          // Ignore session or network error
        }
      }
      const parsedData = await parseMT103(file, resolvedPassword);
      if (!parsedData.full_text) {
        triggerError("Could not extract any text from the PDF.");
        return;
      }

      const curr = parsedData.currency || "";
      const amount = parsedData.amount || "";
      const invoiceNumber = parsedData.invoice_number || "";
      const extractedClientName = parsedData.client_name || "";
      const completeTextBlob = parsedData.full_text || "";

      const formattedDate =
        getInvoiceDateFromValueDate(parsedData.value_date) ?? "";

      // SWIFT code lookup for bank data
      let bankData: any = null;
      const swiftMatches = [
        ...completeTextBlob.matchAll(
          /\b([A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?)\b/g,
        ),
      ];
      for (const match of swiftMatches) {
        const potentialSwift = match[1];
        const bData = await lookupSwiftCode(potentialSwift);
        if (bData) {
          bankData = bData;
          break;
        }
      }

      // Client matching — word-level partial match
      let matchedClient: Client | null = null;
      const sortedClients = [...clients].sort(
        (a, b) => b.name.length - a.name.length,
      );
      const NOISE_WORDS = new Set([
        "ltd",
        "llc",
        "inc",
        "co",
        "pvt",
        "private",
        "limited",
        "the",
        "of",
        "and",
      ]);

      const wordMatch = (dbName: string, pdfText: string): number => {
        const dbWords = dbName
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length >= 2 && !NOISE_WORDS.has(w));
        if (dbWords.length === 0) return 0;
        const pdfLower = pdfText.toLowerCase();
        const matched = dbWords.filter((w) => pdfLower.includes(w)).length;
        return matched / dbWords.length;
      };

      if (extractedClientName && extractedClientName.trim().length >= 3) {
        // Pass 1: exact substring match (stripped)
        const normExtracted = extractedClientName
          .replace(/[^a-z0-9]/g, "")
          .toLowerCase();
        for (const c of sortedClients) {
          const normDb = c.name.replace(/[^a-z0-9]/g, "").toLowerCase();
          if (
            normDb.length >= 3 &&
            (normExtracted === normDb ||
              normExtracted.includes(normDb) ||
              normDb.includes(normExtracted))
          ) {
            matchedClient = c;
            break;
          }
        }

        // Pass 2: word-level partial match (>=60% of significant words found)
        if (!matchedClient) {
          let bestScore = 0;
          for (const c of sortedClients) {
            const score = wordMatch(c.name, extractedClientName);
            if (score >= 0.6 && score > bestScore) {
              bestScore = score;
              matchedClient = c;
            }
          }
        }
      }

      // Pass 3: full-text fallback — search entire PDF text
      if (!matchedClient) {
        const normalizedFullText = completeTextBlob.toLowerCase();
        let bestScore = 0;
        for (const c of sortedClients) {
          // Stripped substring match
          const normDb = c.name.replace(/[^a-z0-9]/g, "").toLowerCase();
          const normFull = normalizedFullText.replace(/[^a-z0-9]/g, "");
          if (normDb.length >= 4 && normFull.includes(normDb)) {
            matchedClient = c;
            break;
          }
          // Word-level match on full text
          const score = wordMatch(c.name, normalizedFullText);
          if (score >= 0.6 && score > bestScore) {
            bestScore = score;
            matchedClient = c;
          }
        }
      }

      let finalInvoiceNumber = invoiceNumber;
      if (!finalInvoiceNumber) {
        const invMatch = completeTextBlob.match(/INV[A-Z0-9\-\_]+/i);
        if (invMatch) finalInvoiceNumber = invMatch[0];
      }

      // Fallback: search details column text and full PDF text for any known invoice number
      if (!finalInvoiceNumber) {
        const detailsText = parsedData.details_text || "";
        const searchTexts = [detailsText, completeTextBlob];
        const sortedInvoices = [...invoices].sort(
          (a, b) =>
            (b.invoice_number?.length || 0) - (a.invoice_number?.length || 0),
        );
        for (const searchText of searchTexts) {
          for (const inv of sortedInvoices) {
            if (
              inv.invoice_number &&
              inv.invoice_number.length >= 3 &&
              searchText.includes(inv.invoice_number)
            ) {
              finalInvoiceNumber = inv.invoice_number;
              break;
            }
          }
          if (finalInvoiceNumber) break;
        }
      }

      const matchInv = invoices.find(
        (inv) => inv.invoice_number === finalInvoiceNumber,
      );
      if (matchInv) {
        setSelectedClientId(matchInv.client_id);
        setSelectedInvoiceId(matchInv.id);
        const cName =
          clients.find((c) => c.id === matchInv.client_id)?.name ||
          "Unknown Client";
        setMatchPopupData({
          invoiceNum: matchInv.invoice_number,
          clientName: cName,
        });
      } else if (matchedClient) {
        setExtractedData({
          invoice_number: finalInvoiceNumber,
          invoice_date: formattedDate,
          amount: amount,
          currency: curr,
          client_id: matchedClient.id,
        });
        setIsCreateModalOpen(true);
      } else {
        setExtractedData({
          invoice_number: finalInvoiceNumber,
          invoice_date: formattedDate,
          amount: amount,
          currency: curr,
          client_id: "",
        });
        setClientDefaultValues({
          name: extractedClientName || "",
          bank_name: bankData?.bank_name || "",
          bank_address:
            [bankData?.branch, bankData?.city, bankData?.country]
              .filter(Boolean)
              .join(", ") || "",
        });
        setIsCreateClientModalOpen(true);
      }
    } catch (err: any) {
      triggerError(err.message || "Error parsing PDF");
    } finally {
      setIsUploadingPdf(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const [activeTab, setActiveTab] = useState<ViewTab>("all");

  const filteredInvoices = invoices
    .filter((i) => i.client_id === selectedClientId)
    .sort((a, b) => (b.invoice_date || "").localeCompare(a.invoice_date || ""));

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const selectedInvoice = invoices.find((i) => i.id === selectedInvoiceId);

  const cFormRef = useRef<HTMLDivElement>(null);
  const bankInvoiceRef = useRef<HTMLDivElement>(null);

  const handlePrintCForm = useReactToPrint({
    contentRef: cFormRef,
    documentTitle: `C-Form-${selectedInvoice?.invoice_number || "doc"}`,
  });

  const handlePrintBankInvoice = useReactToPrint({
    contentRef: bankInvoiceRef,
    documentTitle: `Bank-Invoice-${selectedInvoice?.invoice_number || "doc"}`,
  });

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-8 pb-16">
      {matchPopupData && (
        <Modal
          isOpen={!!matchPopupData}
          onClose={() => setMatchPopupData(null)}
          title="Invoice Match Found!"
          subtitle={`Client: ${matchPopupData.clientName}`}
          icon={<CheckCircle2 className="size-5 text-accent" />}
          maxWidth="sm"
        >
          <div className="p-6 flex flex-col gap-5">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Existing invoice{" "}
              <span className="text-text-strong font-normal">
                {matchPopupData.invoiceNum}
              </span>{" "}
              has been selected automatically from your database.
            </p>
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => setMatchPopupData(null)}
                className="w-full rounded-xl"
              >
                View Invoice
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {errorMessage && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl flex items-center justify-between shadow-2xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5 font-medium text-xs sm:text-sm">
            <AlertCircle className="size-4 sm:size-5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setErrorMessage(null)}
            className="size-7 text-destructive hover:bg-destructive/10"
          >
            <X className="size-4" />
          </Button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-strong">
            Generate Inward Docs
          </h1>
          <p className="text-sm text-muted-foreground">
            Generate and export pixel-perfect Bank Invoices and Form-C (ICT)
            declarations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingPdf}
            className="gap-2 text-xs sm:text-sm font-normal rounded-xl"
          >
            {isUploadingPdf ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : (
              <UploadCloud className="size-4 text-muted-foreground" />
            )}
            <span>{isUploadingPdf ? "Parsing..." : "Autofill from PDF"}</span>
          </Button>
          <Button
            asChild
            className="gap-1.5 text-xs sm:text-sm font-normal rounded-xl"
          >
            <Link href="/invoice-tools/create-invoice">
              <span>Create New Invoice</span>
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>

      <Card className="border-border bg-card shadow-xs">
        <CardContent className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div className="relative z-20 flex flex-col gap-1.5">
            <label className="block text-sm font-normal text-text-strong">
              Select Client
            </label>
            <SearchableClientSelect
              clients={clients}
              value={selectedClientId}
              onChange={(val) => {
                setSelectedClientId(val);
                setSelectedInvoiceId("");
              }}
              placeholder="-- Choose a Client --"
            />
          </div>
          <div className="relative z-10 flex flex-col gap-1.5">
            <label className="block text-sm font-normal text-text-strong">
              Select Invoice
            </label>
            <select
              value={selectedInvoiceId}
              onChange={(e) => setSelectedInvoiceId(e.target.value)}
              disabled={!selectedClientId}
              className="block w-full px-3.5 py-2.5 pr-10 border rounded-xl border-input text-base sm:text-sm focus:ring-2 focus:ring-ring bg-background text-text-strong disabled:opacity-50 disabled:cursor-not-allowed focus:outline-hidden transition-colors cursor-pointer min-h-11"
            >
              <option value="">-- Choose an Invoice --</option>
              {filteredInvoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.invoice_number} ({i.invoice_date}) — {i.currency || "USD"}{" "}
                  {i.amount}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {selectedClient && selectedInvoice && (
        <div className="flex flex-col gap-6">
          {/* Document switcher tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-3">
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 max-w-full">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === "all"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-light text-muted-foreground hover:text-text-strong hover:bg-light/80"
                }`}
              >
                All Documents
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("invoice")}
                className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === "invoice"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-light text-muted-foreground hover:text-text-strong hover:bg-light/80"
                }`}
              >
                Bank Invoice
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("cform")}
                className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === "cform"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-light text-muted-foreground hover:text-text-strong hover:bg-light/80"
                }`}
              >
                Form-C (ICT)
              </button>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              {(activeTab === "all" || activeTab === "invoice") && (
                <Button
                  type="button"
                  onClick={() => handlePrintBankInvoice()}
                  className="flex-1 sm:flex-none justify-center gap-2 rounded-xl text-xs sm:text-sm font-normal"
                >
                  <Printer className="size-4" />
                  <span>Print Invoice</span>
                </Button>
              )}
              {(activeTab === "all" || activeTab === "cform") && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handlePrintCForm()}
                  className="flex-1 sm:flex-none justify-center gap-2 rounded-xl text-xs sm:text-sm font-normal border-border hover:bg-light"
                >
                  <FileText className="size-4" />
                  <span>Print Form-C</span>
                </Button>
              )}
            </div>
          </div>

          {/* Bank Invoice Preview */}
          {(activeTab === "all" || activeTab === "invoice") && (
            <div className="border border-border rounded-2xl overflow-hidden shadow-xs bg-light/30 p-3 sm:p-6 md:p-8">
              <div className="flex justify-between items-center mb-3 sm:mb-4 gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-text-strong flex items-center gap-2">
                  <CheckCircle2 className="size-5 text-accent shrink-0" />
                  <span>Bank Invoice Preview</span>
                </h2>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handlePrintBankInvoice()}
                  className="gap-1.5 rounded-xl font-normal"
                >
                  <Printer className="size-3.5" />
                  <span>Print / Save PDF</span>
                </Button>
              </div>
              <p className="sm:hidden text-center text-xs text-muted-foreground mb-2">
                ← Swipe horizontally to view full page →
              </p>
              <div className="overflow-x-auto flex justify-start sm:justify-center py-2 sm:py-4">
                <div className="shadow-xl rounded-xs shrink-0">
                  <BankInvoice
                    ref={bankInvoiceRef}
                    invoice={selectedInvoice}
                    client={selectedClient}
                    paymentAccounts={paymentAccounts}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Form-C (ICT) Preview */}
          {(activeTab === "all" || activeTab === "cform") && (
            <div className="border border-border rounded-2xl overflow-hidden shadow-xs bg-light/30 p-3 sm:p-6 md:p-8">
              <div className="flex justify-between items-center mb-3 sm:mb-4 gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-text-strong flex items-center gap-2">
                  <CheckCircle2 className="size-5 text-success shrink-0" />
                  <span>Form–C (ICT) Preview</span>
                </h2>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handlePrintCForm()}
                  className="gap-1.5 rounded-xl font-normal border-border hover:bg-light"
                >
                  <Printer className="size-3.5" />
                  <span>Print / Save PDF</span>
                </Button>
              </div>
              <p className="sm:hidden text-center text-xs text-muted-foreground mb-2">
                ← Swipe horizontally to view full page →
              </p>
              <div className="overflow-x-auto flex justify-start sm:justify-center py-2 sm:py-4">
                <div className="shadow-xl rounded-xs shrink-0">
                  <CForm
                    ref={cFormRef}
                    invoice={selectedInvoice}
                    client={selectedClient}
                    paymentAccounts={paymentAccounts}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {(!selectedClient || !selectedInvoice) && (
        <Card className="rounded-2xl border-dashed border-border p-8 sm:p-12 text-center shadow-xs bg-card">
          <div className="size-12 rounded-2xl bg-light text-primary flex items-center justify-center mx-auto mb-3">
            <FileText className="size-6" />
          </div>
          <h3 className="text-base font-bold text-text-strong mb-1">
            {!selectedClientId
              ? "Select a Client to Begin"
              : "Select an Invoice to Preview"}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {!selectedClientId
              ? "Choose a client from the dropdown above to view their available invoices."
              : "Choose an invoice above to preview and export pixel-perfect Bank Invoices and Form-C declarations."}
          </p>
        </Card>
      )}
      <CreateClientModal
        isOpen={isCreateClientModalOpen}
        onClose={() => setIsCreateClientModalOpen(false)}
        defaultValues={clientDefaultValues}
        onSuccess={async (newClientId) => {
          setIsCreateClientModalOpen(false);
          const updatedClients = await getClients();
          setClients(updatedClients);
          setExtractedData((prev: any) => ({
            ...prev,
            client_id: newClientId,
          }));
          setIsCreateModalOpen(true);
        }}
      />
      <CreateInvoiceModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={(invoiceId) => {
          setIsCreateModalOpen(false);
          // Force page refresh to re-fetch newly created invoice
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.href = "?invoiceId=" + invoiceId;
        }}
        clients={clients}
        accounts={paymentAccounts}
        extractedData={extractedData}
      />
    </div>
  );
}
