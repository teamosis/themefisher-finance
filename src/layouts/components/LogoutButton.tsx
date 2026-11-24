"use client";

import { useTransition } from "react";
import { LogOut, Loader2 } from "lucide-react";
import { logoutAction } from "@/actions";
import { cn } from "@/lib/utils/shadcn";

interface LogoutButtonProps {
  showLabel?: boolean;
  variant?: "default" | "sidebar";
  className?: string;
}

export default function LogoutButton({
  showLabel,
  variant,
  className,
}: LogoutButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    startTransition(async () => {
      await logoutAction();
    });
  };

  if (variant === "sidebar" || (showLabel && variant !== "default")) {
    return (
      <button
        type="button"
        onClick={handleLogout}
        disabled={isPending}
        className={cn(
          "flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-150 cursor-pointer disabled:opacity-50 w-full text-left",
          className
        )}
      >
        {isPending ? (
          <Loader2 className="size-4 shrink-0 animate-spin" />
        ) : (
          <LogOut className="size-4 shrink-0" />
        )}
        <span>{isPending ? "Logging out..." : "Log out"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isPending}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-medium text-muted-foreground hover:text-destructive hover:border-destructive/30 hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-50",
        className
      )}
      title="Log out"
      aria-label="Log out"
    >
      {isPending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <LogOut className="size-3.5" />
      )}
      <span>{isPending ? "Logging out..." : "Log out"}</span>
    </button>
  );
}
