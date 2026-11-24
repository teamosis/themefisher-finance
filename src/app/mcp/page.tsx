import { getMcpTokensAction } from "@/actions/mcp";
import McpTokensClient from "./McpTokensClient";

export default async function McpTokensPage() {
  const tokens = await getMcpTokensAction().catch(() => []);

  return <McpTokensClient initialTokens={tokens} />;
}
