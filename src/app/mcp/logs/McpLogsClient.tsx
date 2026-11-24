"use client";

import { getMcpRecentRunsAction } from "@/actions/mcp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";

interface McpLogsClientProps {
  initialRuns: any[];
}

export default function McpLogsClient({ initialRuns }: McpLogsClientProps) {
  const [runs, setRuns] = useState<any[]>(initialRuns);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "completed" | "failed"
  >("all");
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const refreshLogs = async () => {
    setLoading(true);
    try {
      const updated = await getMcpRecentRunsAction(100);
      setRuns(updated);
    } catch (err) {
      console.error("Error refreshing MCP logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        run.toolName
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase().trim()) ||
        run.requestId?.toLowerCase().includes(searchQuery.toLowerCase().trim());

      const matchesStatus =
        statusFilter === "all" || run.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [runs, searchQuery, statusFilter]);

  const completedCount = runs.filter((r) => r.status === "completed").length;
  const failedCount = runs.filter((r) => r.status === "failed").length;

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6 pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-strong">
            Execution Logs
          </h1>
          <p className="text-sm text-text-muted">
            Live audit trail of tool invocations performed by connected AI agents.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={refreshLogs}
          disabled={loading}
          className="gap-2 shrink-0"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Logs</span>
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border">
        <div className="relative flex-1 max-w-md">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by tool name or request ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              statusFilter === "all"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-text-strong hover:bg-muted"
            }`}
          >
            All ({runs.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("completed")}
            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
              statusFilter === "completed"
                ? "bg-emerald-600 text-white"
                : "text-muted-foreground hover:text-text-strong hover:bg-muted"
            }`}
          >
            <CheckCircle2 className="size-3" />
            <span>Completed ({completedCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("failed")}
            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
              statusFilter === "failed"
                ? "bg-destructive text-destructive-foreground"
                : "text-muted-foreground hover:text-text-strong hover:bg-muted"
            }`}
          >
            <XCircle className="size-3" />
            <span>Failed ({failedCount})</span>
          </button>
        </div>
      </div>

      {/* Logs Table / List */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="p-5 pb-3 border-b border-border flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-text-strong">
              Execution History
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Showing {filteredRuns.length} of {runs.length} recorded operations
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredRuns.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Activity className="size-8 stroke-[1.5] text-muted-foreground/60 mb-1" />
              <p className="text-sm font-semibold text-text-strong">
                No Logs Found
              </p>
              <p className="text-xs">
                {runs.length === 0
                  ? "No MCP operations have been recorded yet. Once an agent calls a tool, it will appear here."
                  : "No executions match your search filter."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredRuns.map((run) => {
                const isExpanded = expandedRunId === run.id;
                const isSuccess = run.status === "completed";

                return (
                  <div
                    key={run.id}
                    className="p-4 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={isSuccess ? "outline" : "destructive"}
                          className={`text-[10px] ${
                            isSuccess
                              ? "text-emerald-600 bg-emerald-500/10 border-emerald-500/20"
                              : ""
                          }`}
                        >
                          {run.status}
                        </Badge>

                        <span className="font-mono font-semibold text-xs text-text-strong">
                          {run.toolName}
                        </span>

                        {run.durationMs !== null &&
                          run.durationMs !== undefined && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                              <Clock className="size-3" />
                              {run.durationMs}ms
                            </span>
                          )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="font-mono text-[11px]">
                          {new Date(run.createdAt).toLocaleString()}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedRunId(isExpanded ? null : run.id)
                          }
                          className="flex items-center gap-1 text-primary hover:underline cursor-pointer text-xs font-medium ml-2"
                        >
                          <span>
                            {isExpanded ? "Hide Details" : "Inspect Payload"}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="size-3.5" />
                          ) : (
                            <ChevronDown className="size-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="mt-4 pt-3 border-t border-border/60 flex flex-col gap-3 animate-in fade-in duration-150">
                        {run.requestId && (
                          <div className="text-[11px] text-muted-foreground font-mono">
                            <span className="font-semibold text-text-strong">
                              Request ID:
                            </span>{" "}
                            {run.requestId}
                          </div>
                        )}

                        {run.error && (
                          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-mono">
                            <strong>Execution Error:</strong> {run.error}
                          </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                          <div>
                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                              Input Arguments:
                            </span>
                            <pre className="p-3 bg-muted/60 border border-border rounded-lg font-mono text-[11px] text-text-strong overflow-x-auto max-h-56">
                              {JSON.stringify(run.input || {}, null, 2)}
                            </pre>
                          </div>

                          <div>
                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                              Result Payload (Redacted):
                            </span>
                            <pre className="p-3 bg-muted/60 border border-border rounded-lg font-mono text-[11px] text-text-strong overflow-x-auto max-h-56">
                              {JSON.stringify(run.result || {}, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
