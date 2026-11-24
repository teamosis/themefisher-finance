"use client";

import LogoutButton from "@/components/LogoutButton";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import {
  Activity,
  ArrowLeft,
  Clock,
  KeyRound,
  Landmark,
  Menu,
  Settings,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navItems = [
  {
    name: "Activity Logs",
    href: "/settings/activity-logs",
    icon: Clock,
  },
  {
    name: "MCP Tools",
    href: "/settings/mcp-setup",
    icon: KeyRound,
  },
  {
    name: "MCP Execution Logs",
    href: "/settings/mcp-logs",
    icon: Activity,
  },
  {
    name: "Receiving Accounts",
    href: "/settings/payment-accounts",
    icon: Landmark,
  },
];

export default function SettingsSidebar() {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const closeMobile = () => setIsMobileOpen(false);

  const navContent = (
    <>
      {/* Brand & Tool Header */}
      <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-xs shrink-0">
            <Settings className="size-5" />
          </div>
          <div className="min-w-0">
            <span className="text-sm font-bold text-text-strong block leading-tight truncate">
              Settings &amp; Logs
            </span>
            <span className="text-xs text-muted-foreground truncate block mt-0.5">
              Themefisher Finance
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={closeMobile}
          className="md:hidden p-1.5 text-muted-foreground hover:text-text-strong hover:bg-light rounded-lg transition-colors cursor-pointer"
          aria-label="Close navigation menu"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="p-3 flex flex-col gap-1 flex-1 overflow-y-auto">
        <Link
          href="/"
          onClick={closeMobile}
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-normal text-muted-foreground hover:text-text-strong hover:bg-light transition-all duration-150 group cursor-pointer mb-1"
        >
          <ArrowLeft className="size-4 shrink-0 transition-transform group-hover:-translate-x-0.5" />
          <span>Back to Dashboard</span>
        </Link>

        <div className="h-px bg-border my-1" />

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/settings" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMobile}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-normal transition-all duration-150 cursor-pointer ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-text-strong hover:bg-light"
              }`}
            >
              <Icon
                className={`size-4 shrink-0 transition-colors ${
                  isActive ? "text-primary-foreground" : "text-muted-foreground"
                }`}
              />
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer / Controls */}
      <div className="p-3 border-t border-border shrink-0 flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <LogoutButton showLabel />
        </div>
        <ThemeSwitcher />
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
            <Settings className="size-4" />
          </div>
          <span className="text-sm font-bold text-text-strong">
            Settings &amp; Logs
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          className="p-2 text-muted-foreground hover:text-text-strong hover:bg-light rounded-lg transition-colors cursor-pointer"
          aria-label="Open navigation menu"
        >
          <Menu className="size-5" />
        </button>
      </div>

      {/* Desktop Sticky Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card shrink-0 h-screen sticky top-0">
        {navContent}
      </aside>

      {/* Mobile Fullscreen Overlay Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={closeMobile}
          />
          <div className="relative flex flex-col w-72 max-w-[80vw] bg-card h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
}
