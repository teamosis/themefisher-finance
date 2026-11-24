import { LoginForm } from "@/components/forms/LoginForm";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import config from "@/config/config.json";
import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: `Access Protected | ${config.site.title}`,
  description: "Enter site password to access Themefisher Finance tools.",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col justify-between relative px-4 py-8">
      {/* Top Bar with ThemeSwitcher */}
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-muted/50 border border-border/80 flex items-center justify-center p-1 shadow-xs">
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
        </div>
        {config.settings.theme_switcher && <ThemeSwitcher />}
      </div>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center py-12">
        <div className="w-full max-w-md">
          <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="size-14 rounded-2xl bg-muted/50 border border-border/80 flex items-center justify-center p-2 mb-3 shadow-xs">
                <Image
                  src="/logo.png"
                  alt={config.site.title}
                  width={38}
                  height={38}
                  className="size-full object-contain"
                  priority
                />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-text-strong tracking-tight">
                Authentication Required
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 max-w-xs">
                This internal tool is protected. Please provide the site
                password to continue.
              </p>
            </div>

            <Suspense
              fallback={
                <div className="flex flex-col gap-3 py-4 animate-pulse">
                  <div className="h-4 bg-muted rounded-md w-1/4" />
                  <div className="h-10 bg-muted rounded-md w-full" />
                  <div className="h-10 bg-muted rounded-md w-full mt-2" />
                </div>
              }
            >
              <LoginForm />
            </Suspense>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Themefisher Financial Operations Suite &copy;{" "}
            {new Date().getFullYear()}
          </p>
        </div>
      </main>

      <footer className="text-center text-xs text-muted-foreground">
        Secure Internal Access
      </footer>
    </div>
  );
}
