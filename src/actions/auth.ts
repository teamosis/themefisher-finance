"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getAuthCookieOptions,
  getExpectedAuthToken,
  isAuthConfigured,
} from "@/lib/auth";

export interface AuthActionResult {
  success: boolean;
  error?: string;
  redirectTo?: string;
}

export async function loginAction(
  password: string,
  redirectTo?: string
): Promise<AuthActionResult> {
  if (!isAuthConfigured()) {
    return {
      success: false,
      error:
        "AUTH_PASSWORD and AUTH_SECRET must be configured in environment variables.",
    };
  }

  const expectedPassword = process.env.AUTH_PASSWORD!;
  if (password !== expectedPassword) {
    return {
      success: false,
      error: "Incorrect password. Please try again.",
    };
  }

  const token = await getExpectedAuthToken();
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

  const safeTarget =
    redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")
      ? redirectTo
      : "/";

  return {
    success: true,
    redirectTo: safeTarget,
  };
}

export async function logoutAction() {
  const cookieStore = await cookies();
  const options = getAuthCookieOptions();
  cookieStore.delete(options.name);
  redirect("/login");
}
