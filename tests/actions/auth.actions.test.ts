import { loginAction, logoutAction } from "@/actions/auth";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { cookieStore } from "../setup";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("Auth Server Actions Suite", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.AUTH_PASSWORD = "correct_horse_battery_staple";
    process.env.AUTH_SECRET = "super_salt_phrase_777";
    cookieStore.clear();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("loginAction", () => {
    it("returns error when environment auth is unconfigured", async () => {
      delete process.env.AUTH_PASSWORD;

      const result = await loginAction("some_password");
      expect(result.success).toBe(false);
      expect(result.error).toContain("AUTH_PASSWORD and AUTH_SECRET must be configured");
      expect(cookieStore.has(AUTH_COOKIE_NAME)).toBe(false);
    });

    it("rejects incorrect password with user-friendly error message", async () => {
      const result = await loginAction("wrong_password");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Incorrect password. Please try again.");
      expect(cookieStore.has(AUTH_COOKIE_NAME)).toBe(false);
    });

    it("sets authentication cookie and returns safe redirect on correct password", async () => {
      const result = await loginAction(
        "correct_horse_battery_staple",
        "/scb-tools",
      );

      expect(result.success).toBe(true);
      expect(result.redirectTo).toBe("/scb-tools");
      expect(cookieStore.has(AUTH_COOKIE_NAME)).toBe(true);

      await expect(verifyAuthToken(cookieStore.get(AUTH_COOKIE_NAME)?.value)).resolves.toBe(true);
    });

    it("sanitizes open-redirect targets and defaults to /", async () => {
      const result = await loginAction(
        "correct_horse_battery_staple",
        "//attacker.com",
      );

      expect(result.success).toBe(true);
      expect(result.redirectTo).toBe("/");
    });
  });

  describe("logoutAction", () => {
    it("deletes the session cookie and invokes redirect to /login", async () => {
      cookieStore.set(AUTH_COOKIE_NAME, { value: "mock_session_token" });
      expect(cookieStore.has(AUTH_COOKIE_NAME)).toBe(true);

      await expect(logoutAction()).rejects.toThrow("NEXT_REDIRECT:/login");
      expect(cookieStore.has(AUTH_COOKIE_NAME)).toBe(false);
    });
  });
});
