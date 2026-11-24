"use server";

import {
  getAuthCookieOptions,
  createAuthToken,
  getSafeRedirectPath,
  isAuthConfigured,
} from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, timingSafeEqual } from "node:crypto";

export interface AuthActionResult {
  success: boolean;
  error?: string;
  redirectTo?: string;
}

export async function loginAction(
  password: string,
  redirectTo?: string,
): Promise<AuthActionResult> {
  if (!isAuthConfigured()) {
    return {
      success: false,
      error:
        "AUTH_PASSWORD and AUTH_SECRET must be configured in environment variables.",
    };
  }

  const expectedPassword = process.env.AUTH_PASSWORD!;
  const hash = (value: string) => createHash("sha256").update(value).digest();
  if (typeof password !== "string" || !timingSafeEqual(hash(password), hash(expectedPassword))) {
    return {
      success: false,
      error: "Incorrect password. Please try again.",
    };
  }

  const token = await createAuthToken();
  if (!token) {
    return {
      success: false,
      error: "Authentication service error.",
    };
  }

  const cookieStore = await cookies();
  const options = getAuthCookieOptions();
  cookieStore.set(options.name, token, {
    httpOnly: options.httpOnly,
    secure: options.secure,
    sameSite: options.sameSite,
    path: options.path,
    maxAge: options.maxAge,
  });

  return {
    success: true,
    redirectTo: getSafeRedirectPath(redirectTo),
  };
}

export async function logoutAction() {
  const cookieStore = await cookies();
  const options = getAuthCookieOptions();
  cookieStore.delete(options.name);
  redirect("/login");
}
