"use client";

import {
  ArrowLeft,
  FileText,
  Landmark,
  Menu,
  PlusSquare,
  Settings,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export function InvoiceSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    { name: "Generate Inward Docs", href: "/invoice-tools", icon: FileText },
    {
      name: "Create Invoice",
      href: "/invoice-tools/create-invoice",
      icon: PlusSquare,
    },
    { name: "Clients", href: "/invoice-tools/clients", icon: Users },
    { name: "Configuration", href: "/invoice-tools/settings", icon: Settings },
  ];

  const navContent = (
    <>
      {/* Brand & Tool Header */}
      <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-xs shrink-0">
            <Landmark className="size-5" />
          </div>
          <div className="min-w-0">
            <span className="text-sm font-bold text-text-strong block leading-tight truncate">
              Invoice &amp; Form-C
            </span>
            <span className="text-xs text-muted-foreground truncate block mt-0.5">
              Themefisher Finance
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="md:hidden p-1.5 rounded-lg text-muted-foreground hover:text-text-strong hover:bg-light transition-colors cursor-pointer"
          aria-label="Close menu"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
        <Link
          href="/"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-text-strong hover:bg-light transition-all duration-150 group cursor-pointer mb-1"
        >
          <ArrowLeft className="size-4 shrink-0 transition-transform group-hover:-translate-x-0.5" />
          <span>Back to Dashboard</span>
        </Link>

        <div className="h-px bg-border my-1" />

        {links.map((link) => {
          const Icon = link.icon;
          const isActive =
            pathname === link.href ||
            (link.href !== "/invoice-tools" && pathname.startsWith(link.href));
          return (
            <Link
              key={link.name}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-text-strong hover:bg-light"
              }`}
            >
              <Icon
                className={`size-4 shrink-0 ${
                  isActive ? "text-primary-foreground" : "text-muted-foreground"
                }`}
              />
              <span className="truncate">{link.name}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-card border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
            <Landmark className="size-4" />
          </div>
          <span className="text-sm font-bold text-text-strong">
            Invoice &amp; Form-C
          </span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg text-muted-foreground hover:text-text-strong hover:bg-light transition-colors cursor-pointer"
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </button>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-72 max-w-[80vw] bg-card flex flex-col z-10 shadow-2xl animate-in slide-in-from-left duration-200 border-r border-border">
            {navContent}
          </div>
        </div>
      )}

      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-card border-r border-border shrink-0 h-screen sticky top-0 transition-colors">
        {navContent}
      </aside>
    </>
  );
}
