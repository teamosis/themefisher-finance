import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Footer from "@/partials/Footer";
import Header from "@/partials/Header";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import {
  ArrowRight,
  FileSpreadsheet,
  FileText,
  ShieldAlert,
  KeyRound,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import config from "@/config/config.json";
import { isAuthConfigured } from "@/lib/auth";

export default function Dashboard() {
  const configured = isAuthConfigured();

  if (!configured) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-between">
        <header className="sticky top-0 z-40 bg-card/90 backdrop-blur-md border-b border-border py-2.5 px-4 sm:px-8">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shadow-xs">
                <ShieldAlert className="size-5" />
              </div>
              <span className="text-base font-bold text-text-strong">
                {config.site.title}
              </span>
            </div>
            {config.settings.theme_switcher && <ThemeSwitcher />}
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-12">
          <div className="max-w-xl w-full mx-auto">
            <Card className="border-destructive/30 bg-card shadow-lg overflow-hidden">
              <div className="h-2 bg-destructive w-full" />
              <CardHeader className="p-6 sm:p-8 pb-4 text-center">
                <div className="size-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-4">
                  <KeyRound className="size-7" />
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-destructive/15 text-destructive text-xs font-semibold mx-auto mb-2">
                  <AlertTriangle className="size-3.5" />
                  <span>Setup Required</span>
                </div>
                <CardTitle className="text-2xl font-bold text-text-strong tracking-tight">
                  Environment Variables Missing
                </CardTitle>
                <CardDescription className="text-muted-foreground text-sm mt-2 leading-relaxed">
                  To protect this application, <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted text-text-strong font-semibold">AUTH_PASSWORD</code> and <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted text-text-strong font-semibold">AUTH_SECRET</code> must be set on the environment. Without these variables configured, this site cannot be accessed.
                </CardDescription>
              </CardHeader>

              <CardFooter className="p-6 sm:p-8 pt-2 flex flex-col gap-4">
                <div className="w-full bg-muted/60 border border-border rounded-xl p-4 text-left font-mono text-xs text-text-default overflow-x-auto">
                  <p className="text-muted-foreground mb-2"># Add these to your .env.local file:</p>
                  <p className="text-text-strong">AUTH_PASSWORD=your_secure_password</p>
                  <p className="text-text-strong">AUTH_SECRET=a_random_32_character_secret</p>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  After setting the environment variables in <span className="font-semibold text-text-default">.env.local</span>, restart the Next.js server to unlock access.
                </p>
              </CardFooter>
            </Card>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

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
