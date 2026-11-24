import { getMcpRecentRunsAction } from "@/actions/mcp";
import McpLogsClient from "./McpLogsClient";

export const metadata = {
  title: "MCP Execution Logs | Settings | Themefisher Finance",
  description:
    "Audit trail of tool executions made by AI agents connected via Model Context Protocol.",
};

export default async function SettingsMcpLogsPage() {
  const runs = await getMcpRecentRunsAction(100).catch(() => []);
  return <McpLogsClient initialRuns={runs} />;
}
