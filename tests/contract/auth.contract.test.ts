import {
  AUTH_COOKIE_MAX_AGE,
  AUTH_COOKIE_NAME,
  generateAuthToken,
  getAuthCookieOptions,
  getExpectedAuthToken,
  isAuthConfigured,
  verifyAuthToken,
} from "@/lib/auth";
import assert from "node:assert";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

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

  describe("generateAuthToken", () => {
    it("deterministically generates a 64-character hex string via Web Crypto SHA-256", async () => {
      const token1 = await generateAuthToken("pass123", "secret456");
      const token2 = await generateAuthToken("pass123", "secret456");

      expect(token1).toBe(token2);
      expect(token1).toHaveLength(64);
      expect(token1).toMatch(/^[0-9a-f]{64}$/);
    });

    it("produces completely different hashes when secret or password changes (avoids hash collisions)", async () => {
      const base = await generateAuthToken("pass123", "secret456");
      const diffPass = await generateAuthToken("pass124", "secret456");
      const diffSecret = await generateAuthToken("pass123", "secret457");

      expect(base).not.toBe(diffPass);
      expect(base).not.toBe(diffSecret);
      expect(diffPass).not.toBe(diffSecret);
    });
  });

  describe("getExpectedAuthToken and verifyAuthToken", () => {
    it("returns null when configuration is missing (fail-closed behavior)", async () => {
      delete process.env.AUTH_PASSWORD;
      const expected = await getExpectedAuthToken();
      expect(expected).toBeNull();

      // verifyAuthToken should return false
      expect(await verifyAuthToken("some_token")).toBe(false);
    });

    it("verifies matching token successfully", async () => {
      const expected = await getExpectedAuthToken();
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
