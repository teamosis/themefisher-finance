"use client";

import { loginAction } from "@/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

export function LoginForm() {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/";

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError("Please enter the site password.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await loginAction(password, redirectUrl);
      if (result.success) {
        // Full navigation ensures proxy picks up the fresh auth cookie immediately
        window.location.href = result.redirectTo || "/";
      } else {
        setError(
          result.error || "Authentication failed. Please check your password.",
        );
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium animate-in fade-in">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="site-password"
          className="text-sm font-normal text-text-strong"
        >
          Password
        </label>
        <div className="relative">
          <Input
            id="site-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Enter access password"
            autoFocus
            disabled={isPending}
            className="pr-10 bg-background text-sm font-sans"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-text-strong p-1 rounded-md transition-colors cursor-pointer"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
      </div>

      <Button
        type="submit"
        disabled={isPending || !password}
        className="w-full mt-2 font-medium cursor-pointer"
      >
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin mr-2" />
            <span>Verifying...</span>
          </>
        ) : (
          <>
            <Lock className="size-4 mr-2" />
            <span>Unlock Access</span>
          </>
        )}
      </Button>
    </form>
  );
}
