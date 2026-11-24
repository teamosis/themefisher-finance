import type { z } from "zod";
import type { McpScopeKey } from "./scopes";

export interface McpToolDefinition<T extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  scope: McpScopeKey | "system";
  description: string;
  write: boolean;
  requireIdempotency?: boolean | ((args: z.infer<T>) => boolean);
  schema: T;
  handler: (args: any, scopes?: readonly string[]) => Promise<unknown>;
}

export function defineTool<T extends z.ZodTypeAny>(tool: {
  name: string;
  scope: McpScopeKey | "system";
  description: string;
  write: boolean;
  requireIdempotency?: boolean | ((args: z.infer<T>) => boolean);
  schema: T;
  handler: (args: z.infer<T>, scopes?: readonly string[]) => Promise<unknown>;
}): McpToolDefinition<T> {
  return tool;
}

export class McpToolError extends Error {
  constructor(message: string, public readonly details?: Record<string, unknown>, public readonly noMutation = false) {
    super(message);
  }
}
