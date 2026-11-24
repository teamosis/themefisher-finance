export const AUTH_COOKIE_NAME = "tf_auth_session";
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

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

/**
 * Generate a SHA-256 hex string from password and secret.
 * Fully compatible with Edge Runtime and Node.js environments via standard Web Crypto API.
 */
export async function generateAuthToken(
  password: string,
  secret: string = ""
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${password}:${secret}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Get the expected authentication token based on environment variables.
 * Returns null if AUTH_PASSWORD or AUTH_SECRET is not set (fail-closed behavior).
 */
export async function getExpectedAuthToken(): Promise<string | null> {
  if (!isAuthConfigured()) {
    return null;
  }
  const password = process.env.AUTH_PASSWORD!;
  const secret = (process.env.AUTH_SECRET || process.env.AUTH_secret)!;
  return generateAuthToken(password, secret);
}

/**
 * Verifies if the provided token matches the expected hash.
 */
export async function verifyAuthToken(
  token: string | null | undefined
): Promise<boolean> {
  if (!token) return false;
  const expected = await getExpectedAuthToken();
  if (!expected) return false;
  return token === expected;
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
