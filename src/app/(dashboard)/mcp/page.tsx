import { getMcpRecentRunsAction, getMcpTokensAction } from "@/actions/mcp";
import { Suspense } from "react";
import McpTokensClient from "./mcp-tokens-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "MCP Tools & Logs | Themefisher Finance",
  description:
    "Manage dedicated tokens and inspect live tool execution logs for AI Agents connecting via Model Context Protocol.",
};

export default async function McpSetupPage() {
  const [tokens, runs] = await Promise.all([
    getMcpTokensAction().catch(() => []),
    getMcpRecentRunsAction(100).catch(() => []),
  ]);
  return (
    <Suspense fallback={null}>
      <McpTokensClient initialTokens={tokens} initialRuns={runs} />
    </Suspense>
  );
}
