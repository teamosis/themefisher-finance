import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Footer from "@/partials/Footer";
import Header from "@/partials/Header";
import { ArrowRight, FileSpreadsheet, FileText } from "lucide-react";
import Link from "next/link";

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      <Header />

      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
        <div className="max-w-7xl w-full mx-auto flex flex-col gap-10">
          {/* Hero Section */}
          <section className="text-center flex flex-col items-center gap-3">
            <h1 className="text-3xl sm:text-4xl font-bold text-text-strong tracking-tight">
              Themefisher Finance
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base max-w-xl">
              Internal tools for Bangladesh Bank Form-C declarations, bank
              invoices, and Standard Chartered bulk payouts.
            </p>
          </section>

          {/* Tools Grid - Simple, Clean & Fully Clickable */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto w-full">
            {/* Tool 1: Invoice & Form-C */}
            <Link
              href="/invoice-tools"
              className="group block rounded-xl focus:outline-hidden cursor-pointer"
            >
              <Card className="border-border bg-card group-hover:border-foreground/30 transition-all duration-200 flex flex-col justify-between h-full shadow-xs group-hover:shadow-md">
                <CardHeader className="p-6 pb-4">
                  <div className="size-11 rounded-xl bg-muted text-text-strong flex items-center justify-center mb-4 transition-transform duration-200 group-hover:scale-105">
                    <FileText className="size-5" />
                  </div>
                  <CardTitle className="text-xl font-semibold text-text-strong group-hover:text-primary transition-colors">
                    Invoice &amp; Form-C
                  </CardTitle>
                  <CardDescription className="text-muted-foreground text-sm mt-1.5 leading-relaxed">
                    Generate inward remittance invoices and Bangladesh Bank
                    Form-C declarations with MT103 PDF parsing.
                  </CardDescription>
                </CardHeader>

                <CardFooter className="p-6 pt-2">
                  <div className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium transition-colors group-hover:bg-primary/90">
                    <span>Open Generator</span>
                    <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </div>
                </CardFooter>
              </Card>
            </Link>

            {/* Tool 2: SCB Bulk Transactions */}
            <Link
              href="/scb-tools"
              className="group block rounded-xl focus:outline-hidden cursor-pointer"
            >
              <Card className="border-border bg-card group-hover:border-foreground/30 transition-all duration-200 flex flex-col justify-between h-full shadow-xs group-hover:shadow-md">
                <CardHeader className="p-6 pb-4">
                  <div className="size-11 rounded-xl bg-muted text-text-strong flex items-center justify-center mb-4 transition-transform duration-200 group-hover:scale-105">
                    <FileSpreadsheet className="size-5" />
                  </div>
                  <CardTitle className="text-xl font-semibold text-text-strong group-hover:text-primary transition-colors">
                    SCB Bulk Transactions
                  </CardTitle>
                  <CardDescription className="text-muted-foreground text-sm mt-1.5 leading-relaxed">
                    Generate Standard Chartered Bank bulk payout and monthly
                    employee salary sheet Excel files.
                  </CardDescription>
                </CardHeader>

                <CardFooter className="p-6 pt-2">
                  <div className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium transition-colors group-hover:bg-primary/90">
                    <span>Open Generator</span>
                    <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </div>
                </CardFooter>
              </Card>
            </Link>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
