"use client";

import LogoutButton from "@/components/logout-button";
import ThemeSwitcher from "@/components/theme-switcher";
import { toast } from "@/components/ui/toast";
import config from "@/config/config.json";
import {
  Check,
  Clock,
  Copy,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Inbox,
  Landmark,
  LayoutDashboard,
  Menu,
  PlusSquare,
  Share2,
  UserCheck,
  Users,
  Wrench,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

interface NavSection {
  title?: string;
  items: {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    exact?: boolean;
    badge?: string;
  }[];
}

const navSections: NavSection[] = [
  {
    items: [
      {
        name: "Dashboard",
        href: "/",
        icon: LayoutDashboard,
        exact: true,
      },
    ],
  },
  {
    title: "Inward Remittances",
    items: [
      {
        name: "Create Invoice",
        href: "/create-invoice",
        icon: PlusSquare,
      },
      {
        name: "Invoices & Form-C",
        href: "/invoice-tools",
        icon: FileText,
        exact: true,
      },
      {
        name: "Clients",
        href: "/clients",
        icon: Users,
      },
      {
        name: "Receiving Banks",
        href: "/payment-accounts",
        icon: Landmark,
      },
    ],
  },
  {
    title: "Outward Payouts",
    items: [
      {
        name: "Payment Requests",
        href: "/payment-requests",
        icon: Inbox,
      },
      {
        name: "SCB Batch Export",
        href: "/scb-tools",
        icon: FileSpreadsheet,
        exact: true,
      },
      {
        name: "Beneficiaries",
        href: "/vendors",
        icon: UserCheck,
      },
      {
        name: "Debit Accounts",
        href: "/debit-accounts",
        icon: CreditCard,
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        name: "Activity Logs",
        href: "/activity-logs",
        icon: Clock,
      },
      {
        name: "MCP AI Tools",
        href: "/mcp-setup",
        icon: Wrench,
      },
    ],
  },
];

export default function AppSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const closeMobile = () => setMobileOpen(false);

  const handleCopyPaymentLink = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/request-payment`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    toast.success("Payment request link copied to clipboard!");
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const navContent = (
    <div className="flex flex-col h-full bg-card">
      {/* Brand & App Header */}
      <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
        <Link
          href="/"
          onClick={closeMobile}
          className="flex items-center gap-3 min-w-0 group cursor-pointer"
        >
          <div className="size-9 rounded-xl bg-muted/50 border border-border/80 flex items-center justify-center p-1.5 shadow-xs shrink-0 transition-transform duration-200 group-hover:scale-105">
            <Image
              src="/logo.png"
              alt={config.site.title}
              width={28}
              height={28}
              className="size-full object-contain"
              priority
            />
          </div>
          <div className="min-w-0">
            <span className="text-sm font-bold text-text-strong block leading-tight truncate group-hover:text-primary transition-colors">
              {config.site.title}
            </span>
            <span className="text-xs text-muted-foreground truncate block mt-0.5">
              Operations Suite
            </span>
          </div>
        </Link>
        <button
          type="button"
          onClick={closeMobile}
          className="md:hidden p-1.5 rounded-lg text-muted-foreground hover:text-text-strong hover:bg-muted transition-colors cursor-pointer"
          aria-label="Close navigation menu"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-4">
        {navSections.map((section, idx) => (
          <div key={section.title ?? `section-${idx}`} className="space-y-1">
            {section.title && (
              <div className="px-3 py-1 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
                {section.title}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMobile}
                    className={`flex items-center justify-between px-3 py-2 rounded-md text-sm font-normal transition-all duration-150 cursor-pointer ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-xs font-medium"
                        : "text-muted-foreground hover:text-text-strong hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon
                        className={`size-4 shrink-0 transition-colors ${
                          isActive
                            ? "text-primary-foreground"
                            : "text-muted-foreground"
                        }`}
                      />
                      <span className="truncate">{item.name}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                          isActive
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {/* Quick Payment Link Share Widget in Sidebar */}
        <div className="pt-2">
          <div className="p-3 rounded-xl border border-border/80 bg-muted/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-strong flex items-center gap-1.5">
                <Share2 className="size-3.5 text-primary" />
                Payment Request Link
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Share public claim form with contractors &amp; beneficiaries.
            </p>
            <button
              type="button"
              onClick={handleCopyPaymentLink}
              className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md bg-background hover:bg-muted border border-border text-xs font-medium text-text-strong transition-colors cursor-pointer shadow-2xs"
            >
              {copiedLink ? (
                <>
                  <Check className="size-3.5 text-success" />
                  <span className="text-success">Copied to Clipboard</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5 text-muted-foreground" />
                  <span>Copy Public Form Link</span>
                </>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Footer Controls: Logout & Theme Switcher */}
      <div className="p-3 border-t border-border shrink-0 flex items-center justify-between gap-2 bg-card">
        <div className="flex-1 min-w-0">
          <LogoutButton showLabel />
        </div>
        {config.settings.theme_switcher && <ThemeSwitcher />}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Navigation Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-card border-b border-border sticky top-0 z-30 print:hidden">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-muted/50 border border-border/80 flex items-center justify-center p-1 shadow-xs shrink-0">
            <Image
              src="/logo.png"
              alt={config.site.title}
              width={24}
              height={24}
              className="size-full object-contain"
              priority
            />
          </div>
          <span className="text-sm font-bold text-text-strong">
            {config.site.title}
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg text-muted-foreground hover:text-text-strong hover:bg-muted transition-colors cursor-pointer"
          aria-label="Open navigation menu"
        >
          <Menu className="size-5" />
        </button>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex print:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={closeMobile}
          />
          <div className="relative w-72 max-w-[80vw] bg-card flex flex-col z-10 shadow-2xl animate-in slide-in-from-left duration-200 border-r border-border h-full">
            {navContent}
          </div>
        </div>
      )}

      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-card border-r border-border shrink-0 h-screen sticky top-0 transition-colors print:hidden">
        {navContent}
      </aside>
    </>
  );
}
