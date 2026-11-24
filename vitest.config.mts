import path from "path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@\/components\/(.*)/,
        replacement: path.resolve(import.meta.dirname, "./src/layouts/components/$1"),
      },
      {
        find: /^@\/components$/,
        replacement: path.resolve(import.meta.dirname, "./src/layouts/components/index.ts"),
      },
      {
        find: /^@\/helpers\/(.*)/,
        replacement: path.resolve(import.meta.dirname, "./src/layouts/helpers/$1"),
      },
      {
        find: /^@\/partials\/(.*)/,
        replacement: path.resolve(import.meta.dirname, "./src/layouts/partials/$1"),
      },
      {
        find: /^@\/(.*)/,
        replacement: path.resolve(import.meta.dirname, "./src/$1"),
      },
    ],
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    include: [
      "tests/contract/**/*.test.ts",
      "tests/contract/**/*.test.tsx",
      "tests/routes/**/*.test.ts",
      "tests/actions/**/*.test.ts",
      "tests/mcp/**/*.test.ts",
    ],
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://test_user:test_pass@localhost:5432/test_finance_db",
      AUTH_PASSWORD: "test_master_password_2026",
      AUTH_SECRET: "test_secret_salt_hash_987654321",
      NEXT_PUBLIC_SCB_DEBIT_ACCOUNT: "0001914137101",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    },
  },
});
