import {
  AUTH_COOKIE_MAX_AGE,
  AUTH_COOKIE_NAME,
  getAuthCookieOptions,
  createAuthToken,
  getSafeRedirectPath,
  isAuthConfigured,
  verifyAuthToken,
} from "@/lib/auth";
import assert from "node:assert";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Authentication & Security Contract Suite", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.AUTH_PASSWORD = "test_master_password_2026";
    process.env.AUTH_SECRET = "test_secret_salt_hash_987654321";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("preserves local destinations and falls back to the homepage for external URLs", () => {
    expect(getSafeRedirectPath("/invoice-tools?tab=invoice")).toBe(
      "/invoice-tools?tab=invoice",
    );
    expect(getSafeRedirectPath("https://example.com")).toBe("/");
    expect(getSafeRedirectPath(null)).toBe("/");
  });

  describe("isAuthConfigured", () => {
    it("returns true when both AUTH_PASSWORD and AUTH_SECRET are non-empty strings", () => {
      expect(isAuthConfigured()).toBe(true);
    });

    it("returns false (fail-closed) when AUTH_PASSWORD is missing or whitespace only", () => {
      delete process.env.AUTH_PASSWORD;
      expect(isAuthConfigured()).toBe(false);

      process.env.AUTH_PASSWORD = "   ";
      expect(isAuthConfigured()).toBe(false);
    });

    it("returns false (fail-closed) when AUTH_SECRET is missing or whitespace only", () => {
      delete process.env.AUTH_SECRET;
      delete process.env.AUTH_secret;
      expect(isAuthConfigured()).toBe(false);

      process.env.AUTH_SECRET = "   ";
      expect(isAuthConfigured()).toBe(false);
    });

    it("supports lowercase AUTH_secret environment variable fallback", () => {
      delete process.env.AUTH_SECRET;
      process.env.AUTH_secret = "lowercase_secret_val";
      expect(isAuthConfigured()).toBe(true);
    });
  });

  describe("createAuthToken and verifyAuthToken", () => {
    it("issues a unique token for each login", async () => {
      const first = await createAuthToken();
      const second = await createAuthToken();
      expect(first).not.toBe(second);
      await expect(verifyAuthToken(first)).resolves.toBe(true);
      await expect(verifyAuthToken(second)).resolves.toBe(true);
    });

    it("rejects a signed token after its server-side expiration", async () => {
      const issuedAt = Date.now();
      const token = await createAuthToken();
      const clock = vi.spyOn(Date, "now").mockReturnValue(issuedAt + AUTH_COOKIE_MAX_AGE * 1000);
      try {
        await expect(verifyAuthToken(token)).resolves.toBe(false);
      } finally {
        clock.mockRestore();
      }
    });

    it("invalidates sessions when either credential changes", async () => {
      const first = await createAuthToken();
      process.env.AUTH_PASSWORD = "new_password";
      await expect(verifyAuthToken(first)).resolves.toBe(false);
      const second = await createAuthToken();
      process.env.AUTH_SECRET = "new_secret";
      await expect(verifyAuthToken(second)).resolves.toBe(false);
    });

    it("returns null when configuration is missing (fail-closed behavior)", async () => {
      delete process.env.AUTH_PASSWORD;
      const expected = await createAuthToken();
      expect(expected).toBeNull();

      // verifyAuthToken should return false
      expect(await verifyAuthToken("some_token")).toBe(false);
    });

    it("verifies matching token successfully", async () => {
      const expected = await createAuthToken();
      expect(expected).toBeTruthy();
      expect(await verifyAuthToken(expected)).toBe(true);
    });

    it("rejects invalid, empty, or mismatched tokens", async () => {
      expect(await verifyAuthToken(null)).toBe(false);
      expect(await verifyAuthToken(undefined)).toBe(false);
      expect(await verifyAuthToken("")).toBe(false);
      expect(await verifyAuthToken("0".repeat(64))).toBe(false);
      expect(await verifyAuthToken("tampered_token_xyz")).toBe(false);
    });
  });

  describe("getAuthCookieOptions", () => {
    it("returns secure cookie settings conforming to application policy", () => {
      const opts = getAuthCookieOptions();
      assert.strictEqual(opts.name, AUTH_COOKIE_NAME);
      assert.strictEqual(opts.name, "tf_auth_session");
      assert.strictEqual(opts.httpOnly, true);
      assert.strictEqual(opts.sameSite, "lax");
      assert.strictEqual(opts.path, "/");
      assert.strictEqual(opts.maxAge, AUTH_COOKIE_MAX_AGE);
      assert.strictEqual(opts.maxAge, 60 * 60 * 24 * 30); // 30 days
    });
  });
});
