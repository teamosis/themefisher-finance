import { AUTH_COOKIE_NAME, createAuthToken } from "@/lib/auth";
import { proxy } from "@/proxy";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("Proxy & Route Protection Integration Suite", () => {
  const originalEnv = process.env;
  let validToken: string;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    process.env.AUTH_PASSWORD = "test_master_password_2026";
    process.env.AUTH_SECRET = "test_secret_salt_hash_987654321";
    validToken = (await createAuthToken())!;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const createReq = (
    url: string,
    cookieToken?: string | null,
  ): NextRequest => {
    const req = new NextRequest(url);
    if (cookieToken) {
      req.cookies.set(AUTH_COOKIE_NAME, cookieToken);
    }
    return req;
  };

  it("allows /api/mcp requests to pass through without session cookie (authenticates via Bearer)", async () => {
    const req = createReq("http://localhost:3000/api/mcp");
    const res = await proxy(req);
    // Should pass through with 200 or next response
    expect(res.headers.get("location")).toBeNull();
  });

  it("allows /api/mcp sub-paths to pass through", async () => {
    const req = createReq("http://localhost:3000/api/mcp/tools");
    const res = await proxy(req);
    expect(res.headers.get("location")).toBeNull();
  });

  it("allows /request-payment and /track-payment to pass through without session cookie", async () => {
    const req1 = createReq("http://localhost:3000/request-payment");
    const res1 = await proxy(req1);
    expect(res1.headers.get("location")).toBeNull();

    const req2 = createReq("http://localhost:3000/track-payment");
    const res2 = await proxy(req2);
    expect(res2.headers.get("location")).toBeNull();
  });

  describe("when auth is unconfigured in environment", () => {
    beforeEach(() => {
      delete process.env.AUTH_PASSWORD;
      delete process.env.AUTH_SECRET;
    });

    it("allows the homepage (/) to render to display setup instructions", async () => {
      const req = createReq("http://localhost:3000/");
      const res = await proxy(req);
      expect(res.headers.get("location")).toBeNull();
    });

    it("redirects all other routes to homepage when auth is unconfigured", async () => {
      const req = createReq("http://localhost:3000/invoice-tools");
      const res = await proxy(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3000/");
    });
  });

  describe("unauthenticated user visits protected routes", () => {
    it("redirects unauthenticated visits to /login with redirect param", async () => {
      const req = createReq("http://localhost:3000/invoice-tools");
      const res = await proxy(req);

      expect(res.status).toBe(307);
      const location = res.headers.get("location");
      expect(location).toContain("/login");
      expect(location).toContain("redirect=%2Finvoice-tools");
    });

    it("preserves query parameters in redirect URL", async () => {
      const req = createReq("http://localhost:3000/scb-tools?tab=vendors");
      const res = await proxy(req);

      const location = res.headers.get("location");
      expect(location).toContain("redirect=%2Fscb-tools%3Ftab%3Dvendors");
    });

    it("redirects unauthenticated visits to homepage to /login without redirect param", async () => {
      const req = createReq("http://localhost:3000/");
      const res = await proxy(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3000/login");
    });

    it("allows unauthenticated visit to /login", async () => {
      const req = createReq("http://localhost:3000/login");
      const res = await proxy(req);
      expect(res.headers.get("location")).toBeNull();
    });
  });

  describe("authenticated user visits", () => {
    it("allows authenticated requests to access protected routes", async () => {
      const req = createReq("http://localhost:3000/invoice-tools", validToken);
      const res = await proxy(req);
      expect(res.headers.get("location")).toBeNull();
    });

    it("redirects authenticated user away from /login to homepage by default", async () => {
      const req = createReq("http://localhost:3000/login", validToken);
      const res = await proxy(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3000/");
    });

    it("redirects authenticated user away from /login to safe relative redirect target", async () => {
      const req = createReq(
        "http://localhost:3000/login?redirect=/vendors",
        validToken,
      );
      const res = await proxy(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe(
        "http://localhost:3000/vendors",
      );
    });

    it("neutralizes open-redirect attempts (e.g. //evil.com or https://evil.com) and defaults to /", async () => {
      // Protocol-relative //evil.com
      const req1 = createReq(
        "http://localhost:3000/login?redirect=//evil.com",
        validToken,
      );
      const res1 = await proxy(req1);
      expect(res1.headers.get("location")).toBe("http://localhost:3000/");

      // Absolute URL https://attacker.com
      const req2 = createReq(
        "http://localhost:3000/login?redirect=https://attacker.com",
        validToken,
      );
      const res2 = await proxy(req2);
      expect(res2.headers.get("location")).toBe("http://localhost:3000/");
    });
  });
});
