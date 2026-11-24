export const AUTH_COOKIE_NAME = "tf_auth_session";
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function getSafeRedirectPath(target: string | null | undefined): string {
  if (!target?.startsWith("/") || target.startsWith("//") || target.includes("\\")) {
    return "/";
  }

  const origin = "https://finance.invalid";
  const url = new URL(target, origin);
  return url.origin === origin ? target : "/";
}

/**
 * Checks whether both AUTH_PASSWORD and AUTH_SECRET are configured.
 */
export function isAuthConfigured(): boolean {
  const password = process.env.AUTH_PASSWORD;
  const secret = process.env.AUTH_SECRET || process.env.AUTH_secret;
  return Boolean(
    password &&
      password.trim() !== "" &&
      secret &&
      secret.trim() !== ""
  );
}

const encoder = new TextEncoder();

async function importSigningKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function signedSessionData(password: string, expiration: string, nonce: string) {
  return encoder.encode(JSON.stringify(["tf_auth_v1", password, expiration, nonce]));
}

export async function createAuthToken(): Promise<string | null> {
  if (!isAuthConfigured()) return null;

  const password = process.env.AUTH_PASSWORD!;
  const secret = (process.env.AUTH_SECRET || process.env.AUTH_secret)!;
  const expiration = String(Math.floor(Date.now() / 1000) + AUTH_COOKIE_MAX_AGE);
  const nonce = crypto.randomUUID();
  const key = await importSigningKey(secret);
  const signature = new Uint8Array(await crypto.subtle.sign(
    "HMAC", key, signedSessionData(password, expiration, nonce),
  ));
  const hex = Array.from(signature, (byte) => byte.toString(16).padStart(2, "0")).join("");

  return `${expiration}.${nonce}.${hex}`;
}

export async function verifyAuthToken(token: string | null | undefined): Promise<boolean> {
  if (!token || !isAuthConfigured()) return false;
  const match = /^(\d{1,11})\.([a-f0-9-]{36})\.([a-f0-9]{64})$/.exec(token);
  if (!match) return false;

  const [, expiration, nonce, signature] = match;
  if (Number(expiration) <= Math.floor(Date.now() / 1000)) return false;

  const password = process.env.AUTH_PASSWORD!;
  const secret = (process.env.AUTH_SECRET || process.env.AUTH_secret)!;
  return crypto.subtle.verify(
    "HMAC",
    await importSigningKey(secret),
    Uint8Array.from(signature.match(/../g)!, (byte) => Number.parseInt(byte, 16)),
    signedSessionData(password, expiration, nonce),
  );
}

/**
 * Standard cookie configuration for the auth session.
 */
export function getAuthCookieOptions() {
  return {
    name: AUTH_COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE,
  };
}
