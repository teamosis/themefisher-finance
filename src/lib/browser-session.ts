import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "./auth";

export async function requireBrowserSession(): Promise<void> {
  const session = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!(await verifyAuthToken(session))) {
    throw new Error("Authentication required");
  }
}
