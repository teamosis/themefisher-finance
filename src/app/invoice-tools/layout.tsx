import { InvoiceSidebar } from "@/partials/InvoiceSidebar";

export default function InvoiceToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-background text-text-default">
      <InvoiceSidebar />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 min-w-0">
        {children}
      </main>
    </div>
  );
}
