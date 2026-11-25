"use server";

import { requireBrowserSession } from "@/lib/browser-session";
import { mcpClientConfig, setupPrompt } from "@/lib/mcp/policy";
import {
  getMcpOrigin,
  mcpTokenService,
  type McpTokenRecord,
} from "@/lib/mcp/token-service";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

async function resolveOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) return getMcpOrigin();
  try {
    const h = await headers();
    const origin = h.get("origin");
    if (origin) return origin;
    const host = h.get("host");
    if (host) {
      const proto = h.get("x-forwarded-proto") || "http";
      return `${proto}://${host}`;
    }
  } catch {}
  return getMcpOrigin();
}

export async function getMcpTokensAction(): Promise<McpTokenRecord[]> {
  await requireBrowserSession();
  return mcpTokenService.listTokens();
}

export async function createMcpTokenAction(input: {
  name: string;
  readOnly?: boolean;
  allowedScopes?: string[];
  expiresInDays?: number;
}): Promise<{
  token: string;
  id: string;
  prefix: string;
  name: string;
  prompt: string;
  mcpConfig: string;
}> {
  await requireBrowserSession();
  if (!input.name || !input.name.trim()) {
    throw new Error("Agent / Token name is required");
  }

  const result = await mcpTokenService.createToken(input);
  const origin = await resolveOrigin();
  const prompt = setupPrompt(origin, result.token);
  const mcpConfig = mcpClientConfig(origin, result.token);

  revalidatePath("/mcp");
  return {
    ...result,
    prompt,
    mcpConfig,
  };
}

export async function revokeMcpTokenAction(id: string): Promise<boolean> {
  await requireBrowserSession();
  const result = await mcpTokenService.revokeToken(id);
  revalidatePath("/mcp");
  return result;
}

export async function deleteMcpTokenAction(id: string): Promise<boolean> {
  await requireBrowserSession();
  const result = await mcpTokenService.deleteToken(id);
  revalidatePath("/mcp");
  return result;
}

export async function rotateMcpTokenAction(id: string): Promise<{
  token: string;
  id: string;
  prefix: string;
  name: string;
  prompt: string;
  mcpConfig: string;
}> {
  await requireBrowserSession();
  const result = await mcpTokenService.rotateToken(id);
  const origin = await resolveOrigin();
  const prompt = setupPrompt(origin, result.token);
  const mcpConfig = mcpClientConfig(origin, result.token);

  revalidatePath("/mcp");
  return {
    ...result,
    prompt,
    mcpConfig,
  };
}

export async function getMcpRecentRunsAction(limit: number = 50) {
  await requireBrowserSession();
  return mcpTokenService.getRecentRuns(limit);
}
