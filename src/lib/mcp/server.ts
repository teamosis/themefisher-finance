import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { MCP_POLICY, redact } from "./policy";
import { tokenAllowsTool } from "./scopes";
import {
  getMcpOrigin,
  McpAuthError,
  mcpTokenService,
  type McpTokenRecord,
} from "./token-service";
import { tools } from "./tools";
import { McpToolError } from "./tool-definition";
import { compactWriteReceipt, completeWriteRequest, releaseWriteRequest, reserveWriteRequest } from "./write-requests";

const writeRequestKey = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .optional()
  .describe(
    "Reuse this key when retrying the same write. A completed retry returns an acknowledgement.",
  );

const MAX_MCP_REQUEST_BYTES = 256 * 1024; // 256KB

export function buildMcpServer(token: McpTokenRecord) {
  const server = new McpServer(
    { name: "themefisher-finance", version: "1.0.0" },
    { instructions: MCP_POLICY },
  );

  // Resource 1: Deployment & Policy
  server.registerResource(
    "policy",
    "finance://policy",
    {
      title: "Finance MCP Policy",
      description: "Security and usage policies for Themefisher Finance tools",
      mimeType: "text/plain",
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "text/plain", text: MCP_POLICY }],
    }),
  );

  // Resource 2: Deployment Context
  server.registerResource(
    "context",
    "finance://context",
    {
      title: "Finance MCP Context",
      description: "Deployment context, token identity, and allowed modules",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({
            server: "themefisher-finance",
            version: "1.0.0",
            origin: getMcpOrigin(),
            agentName: token.name,
            readOnly: token.readOnly,
            allowedScopes: token.allowedScopes,
          }),
        },
      ],
    }),
  );

  const permittedTools = tools.filter((tool) =>
    tokenAllowsTool(token.allowedScopes, tool.name) && (!tool.write || !token.readOnly),
  );

  server.registerResource(
    "workflows",
    "finance://workflows",
    {
      title: "Finance workflows and available tools",
      description: "Tool catalog for the current token and links to finance workflows",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [{
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify({
          tools: permittedTools.map(({ name, scope, write, description }) => ({ name, scope, write, description })),
          links: {
            invoiceAndFormC: new URL("/invoice-tools", getMcpOrigin()).href,
            remittancePdfImport: new URL("/create-invoice", getMcpOrigin()).href,
            paymentRequestForm: new URL("/request-payment", getMcpOrigin()).href,
            paymentRequestReview: new URL("/payment-requests", getMcpOrigin()).href,
            paymentTracking: new URL("/track-payment", getMcpOrigin()).href,
            scbTools: new URL("/scb-tools", getMcpOrigin()).href,
          },
        }),
      }],
    }),
  );

  for (const tool of permittedTools) {
      server.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema:
            tool.write && tool.schema instanceof z.ZodObject
              ? tool.schema.safeExtend({ idempotencyKey: tool.requireIdempotency === true ? writeRequestKey.unwrap() : writeRequestKey })
              : (tool.schema as any),
          annotations: {
            readOnlyHint: !tool.write,
            destructiveHint: tool.write,
          },
        },
        async (args: any) => {
          const startTime = Date.now();
          const requestId = crypto.randomUUID();
          let reservedKey: string | undefined;

          try {
            if (tool.write && token.readOnly) {
              throw new McpAuthError(
                "Read-only token cannot execute write operations",
                403,
              );
            }
            if (!tokenAllowsTool(token.allowedScopes, tool.name)) {
              throw new McpAuthError(
                `Operation '${tool.name}' is outside this token's permitted scopes`,
                403,
              );
            }

            const parsedArgs = tool.schema.parse(args ?? {});
            const key = tool.write
              ? writeRequestKey.parse(args?.idempotencyKey)
              : undefined;
            const requiresKey = typeof tool.requireIdempotency === "function"
              ? tool.requireIdempotency(parsedArgs)
              : tool.requireIdempotency;
            if (requiresKey && !key) {
              throw new McpToolError("Provide an idempotencyKey and reuse it only when retrying this write.");
            }
            if (key) {
              const requestHash = createHash("sha256")
                .update(JSON.stringify({ tool: tool.name, args: parsedArgs }))
                .digest("hex");
              const status = await reserveWriteRequest(
                token.id,
                key,
                requestHash,
              );
              if (typeof status === "object") {
                const receipt = { ...status.receipt, success: true, duplicate: true };
                return {
                  content: [
                    { type: "text" as const, text: JSON.stringify(receipt) },
                  ],
                  structuredContent: receipt,
                };
              }
              if (status === "conflict")
                throw new McpAuthError(
                  "Idempotency key was used with different input",
                  409,
                );
              if (status === "pending")
                throw new McpAuthError(
                  "A write with this key is pending or requires reconciliation",
                  409,
                );
              reservedKey = key;
            }
            const rawResult = await tool.handler(
              parsedArgs,
              token.allowedScopes,
            );
            const safe = redact(rawResult);
            if (reservedKey) await completeWriteRequest(token.id, reservedKey, compactWriteReceipt(safe));
            const durationMs = Date.now() - startTime;

            await mcpTokenService.recordRun({
              tokenId: token.id,
              toolName: tool.name,
              requestId,
              status: "completed",
              durationMs,
            });

            const structuredContent =
              safe && typeof safe === "object" && !Array.isArray(safe)
                ? (safe as Record<string, unknown>)
                : undefined;

            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(safe, null, 2),
                },
              ],
              ...(structuredContent ? { structuredContent } : {}),
            };
          } catch (err: unknown) {
            if (reservedKey && err instanceof McpToolError && err.noMutation) {
              await releaseWriteRequest(token.id, reservedKey).catch(() => {});
            }
            const durationMs = Date.now() - startTime;
            const errorMessage =
              err instanceof McpAuthError || err instanceof McpToolError || err instanceof z.ZodError
                ? err.message
                : "Operation failed. Verify the record before retrying a write.";

            await mcpTokenService.recordRun({
              tokenId: token.id,
              toolName: tool.name,
              requestId,
              status: "failed",
              durationMs,
            });

            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    error: errorMessage,
                    ...(err instanceof McpToolError && err.details ? { details: err.details } : {}),
                  }),
                },
              ],
              isError: true,
            };
          }
        },
      );
  }

  return server;
}

const mcpHandler = createMcpHandler(
  ({ authInfo }) => {
    const token = authInfo?.extra?.token as McpTokenRecord | undefined;
    if (!token) throw new McpAuthError("MCP token principal required", 401);
    return buildMcpServer(token);
  },
  { legacy: "stateless", maxRequestBodySize: MAX_MCP_REQUEST_BYTES },
);

export async function handleMcp(req: Request) {
  try {
    const token = await mcpTokenService.verify(req);

    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (contentLength > MAX_MCP_REQUEST_BYTES) {
      return new Response(
        JSON.stringify({ error: "Request payload too large" }),
        {
          status: 413,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const reader = req.body?.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    if (reader) {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        length += chunk.value.byteLength;
        if (length > MAX_MCP_REQUEST_BYTES) {
          await reader.cancel();
          return new Response(
            JSON.stringify({ error: "Request payload too large" }),
            {
              status: 413,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        chunks.push(chunk.value);
      }
    }

    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const body = length > 0 ? JSON.parse(new TextDecoder().decode(bytes)) : {};

    if (Array.isArray(body)) {
      return Response.json(
        { error: "Batch messages are not supported" },
        { status: 400 },
      );
    }

    return await mcpHandler.fetch(req, {
      parsedBody: body,
      authInfo: {
        token: req.headers.get("authorization")!.replace(/^Bearer\s+/i, ""),
        clientId: token.id,
        scopes: token.allowedScopes,
        extra: { token },
      },
    });
  } catch (error: any) {
    const status =
      error instanceof McpAuthError
        ? error.statusCode
        : error instanceof SyntaxError
          ? 400
          : 500;
    const message =
      error instanceof McpAuthError ? error.message : "MCP request rejected";
    return Response.json(
      { error: message },
      {
        status,
        headers: {
          "Cache-Control": "no-store",
          ...(status === 401 && {
            "WWW-Authenticate": "Bearer realm=themefisher-finance-mcp",
          }),
        },
      },
    );
  }
}
