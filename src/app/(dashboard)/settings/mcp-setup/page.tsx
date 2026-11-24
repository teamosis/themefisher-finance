import { getMcpTokensAction } from "@/actions/mcp";
import McpTokensClient from "./McpTokensClient";

export const metadata = {
  title: "MCP Tools | Settings | Themefisher Finance",
  description:
    "Manage dedicated tokens and client configurations for AI Agents connecting via Model Context Protocol.",
};

export default async function SettingsMcpSetupPage() {
  const tokens = await getMcpTokensAction().catch(() => []);
  return <McpTokensClient initialTokens={tokens} />;
}
