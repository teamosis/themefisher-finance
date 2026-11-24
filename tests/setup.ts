import { vi } from "vitest";

const cookieStore = new Map<string, any>();

vi.mock("next/headers", () => ({
  headers: vi.fn(
    async () =>
      new Headers({
        host: "localhost:3000",
        origin: "http://localhost:3000",
        "x-forwarded-proto": "http",
      }),
  ),
  cookies: vi.fn(async () => ({
    get: vi.fn((key: string) => cookieStore.get(key)),
    set: vi.fn((key: string, val: any, _options?: any) => {
      cookieStore.set(key, { value: val });
    }),
    delete: vi.fn((key: string) => {
      cookieStore.delete(key);
    }),
    has: vi.fn((key: string) => cookieStore.has(key)),
  })),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
  revalidateTag: vi.fn(),
}));

// Export helper for tests to inspect/reset cookieStore if needed
export { cookieStore };
