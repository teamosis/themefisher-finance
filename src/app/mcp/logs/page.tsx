import { getMcpRecentRunsAction } from "@/actions/mcp";
import McpLogsClient from "./McpLogsClient";

export const metadata = {
  title: "MCP Execution Logs | Themefisher Finance",
  description:
    "Audit trail of tool executions made by AI agents connected via Model Context Protocol.",
};

export default async function McpLogsPage() {
  const runs = await getMcpRecentRunsAction(100).catch(() => []);

  return <McpLogsClient initialRuns={runs} />;
}
