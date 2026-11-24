import { AUTH_COOKIE_NAME, createAuthToken } from "@/lib/auth";
import { cookieStore } from "./setup";

export async function establishBrowserSession() {
  cookieStore.set(AUTH_COOKIE_NAME, { value: await createAuthToken() });
}
