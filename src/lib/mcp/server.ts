import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { createHash } from "node:crypto";
import { MCP_POLICY, redact } from "./policy";
import { tokenAllowsTool } from "./scopes";
import { tools } from "./tools";
import {
  getMcpOrigin,
  McpAuthError,
  mcpTokenService,
  type McpTokenRecord,
} from "./token-service";

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

  // Register all permitted domain tools as first-class tools
  for (const tool of tools) {
    const isAllowed = tokenAllowsTool(token.allowedScopes, tool.name);
    const isWritePermitted = !tool.write || !token.readOnly;

    if (isAllowed && isWritePermitted) {
      server.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: tool.schema as any,
          annotations: {
            readOnlyHint: !tool.write,
            destructiveHint: tool.write,
          },
        },
        async (args: any) => {
          const startTime = Date.now();
          const requestId =
            (typeof args?.requestId === "string" ? args.requestId : undefined) ||
            crypto.randomUUID();
          const requestHash = createHash("sha256")
            .update(JSON.stringify({ tool: tool.name, args }))
            .digest("hex");

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
            const rawResult = await tool.handler(parsedArgs);
            const safe = redact(rawResult);
            const durationMs = Date.now() - startTime;

            await mcpTokenService.recordRun({
              tokenId: token.id,
              toolName: tool.name,
              requestId,
              requestHash,
              status: "completed",
              input: args,
              result: safe,
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
          } catch (err: any) {
            const durationMs = Date.now() - startTime;
            const errorMessage =
              err?.message || "Operation failed or parameters rejected";

            await mcpTokenService.recordRun({
              tokenId: token.id,
              toolName: tool.name,
              requestId,
              requestHash,
              status: "failed",
              input: args,
              error: errorMessage,
              durationMs,
            });

            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({ error: errorMessage }),
                },
              ],
              isError: true,
            };
          }
        },
      );
    }
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
      return new Response(JSON.stringify({ error: "Request payload too large" }), {
        status: 413,
        headers: { "Content-Type": "application/json" },
      });
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
          return new Response(JSON.stringify({ error: "Request payload too large" }), {
            status: 413,
            headers: { "Content-Type": "application/json" },
          });
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
    const status = error instanceof McpAuthError ? error.statusCode : 400;
    return Response.json(
      { error: error?.message || "MCP request rejected" },
      {
        status,
        headers: {
          "Cache-Control": "no-store",
          "WWW-Authenticate": "Bearer realm=themefisher-finance-mcp",
        },
      },
    );
  }
}
