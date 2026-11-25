"use client";

import {
  createMcpTokenAction,
  deleteMcpTokenAction,
  getMcpTokensAction,
  revokeMcpTokenAction,
  rotateMcpTokenAction,
} from "@/actions/mcp";
import { Modal } from "@/components/modals/modal";
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
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import {
  DEFAULT_SCOPE_KEYS,
  MCP_SCOPES,
  type McpScopeKey,
} from "@/lib/mcp/scopes";
import type { McpTokenRecord } from "@/lib/mcp/token-service";
import {
  Activity,
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  KeyRound,
  Plus,
  RotateCw,
  Search,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

interface McpTokensClientProps {
  initialTokens: McpTokenRecord[];
  initialRuns?: any[];
}

export default function McpTokensClient({
  initialTokens,
  initialRuns = [],
}: McpTokensClientProps) {
  const searchParams = useSearchParams();
  const [activeMainTab, setActiveMainTab] = useState<"tokens" | "logs">(() =>
    searchParams.get("tab") === "logs" ? "logs" : "tokens",
  );

  const [tokens, setTokens] = useState<McpTokenRecord[]>(initialTokens);
  const [runs] = useState<any[]>(initialRuns);
  const [searchLogsQuery, setSearchLogsQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "completed" | "failed"
  >("all");
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // One-Time Connection Setup State (Same as portal-app)
  const [setupPrompt, setSetupPrompt] = useState("");
  const [setupConfig, setSetupConfig] = useState("");
  const [setupTab, setSetupTab] = useState<"prompt" | "config">("prompt");
  const [copiedSetup, setCopiedSetup] = useState(false);

  // Create Token Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [isReadOnly, setIsReadOnly] = useState(true);
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    ...DEFAULT_SCOPE_KEYS,
  ]);
  const allStandardScopesSelected = DEFAULT_SCOPE_KEYS.every((scope) =>
    selectedScopes.includes(scope),
  );
  const [expiresInDays, setExpiresInDays] = useState(90);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Revoke confirmation modal state
  const [tokenToRevoke, setTokenToRevoke] = useState<McpTokenRecord | null>(
    null,
  );
  const [isRevoking, setIsRevoking] = useState(false);

  // Rotate confirmation modal state
  const [tokenToRotate, setTokenToRotate] = useState<McpTokenRecord | null>(
    null,
  );
  const [isRotating, setIsRotating] = useState(false);

  // Delete confirmation modal state
  const [tokenToDelete, setTokenToDelete] = useState<McpTokenRecord | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const refreshData = async () => {
    try {
      const updatedTokens = await getMcpTokensAction();
      setTokens(updatedTokens);
    } catch (err) {
      console.error("Error refreshing MCP tokens:", err);
    }
  };

  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      const matchesSearch =
        searchLogsQuery.trim() === "" ||
        run.toolName
          ?.toLowerCase()
          .includes(searchLogsQuery.toLowerCase().trim()) ||
        run.requestId
          ?.toLowerCase()
          .includes(searchLogsQuery.toLowerCase().trim());

      const matchesStatus =
        statusFilter === "all" || run.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [runs, searchLogsQuery, statusFilter]);

  const completedCount = runs.filter((r) => r.status === "completed").length;
  const failedCount = runs.filter((r) => r.status === "failed").length;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const copyActiveSetup = () => {
    const textToCopy = setupTab === "config" ? setupConfig : setupPrompt;
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopiedSetup(true);
    setTimeout(() => setCopiedSetup(false), 2000);
  };

  const clearOneTimeSetup = () => {
    setSetupPrompt("");
    setSetupConfig("");
    setCopiedSetup(false);
  };

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentName.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await createMcpTokenAction({
        name: agentName.trim(),
        readOnly: isReadOnly,
        allowedScopes: selectedScopes,
        expiresInDays,
      });

      // Populate Connection Setup Prompt & Config (Same as portal-app)
      setSetupPrompt(res.prompt);
      setSetupConfig(res.mcpConfig);
      setSetupTab("prompt");
      setCopiedSetup(false);

      setCreateModalOpen(false);
      setAgentName("");
      setIsReadOnly(true);
      setSelectedScopes([...DEFAULT_SCOPE_KEYS]);

      await refreshData();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      toast.error("Failed to create token: " + (err.message || String(err)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeConfirm = async () => {
    if (!tokenToRevoke) return;
    setIsRevoking(true);
    try {
      await revokeMcpTokenAction(tokenToRevoke.id);
      setTokenToRevoke(null);
      await refreshData();
    } catch (err: any) {
      toast.error("Failed to revoke token: " + (err.message || String(err)));
    } finally {
      setIsRevoking(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!tokenToDelete) return;
    setIsDeleting(true);
    try {
      await deleteMcpTokenAction(tokenToDelete.id);
      setTokenToDelete(null);
      await refreshData();
    } catch (err: any) {
      toast.error("Failed to delete token: " + (err.message || String(err)));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRotateConfirm = async () => {
    if (!tokenToRotate) return;
    setIsRotating(true);
    try {
      const res = await rotateMcpTokenAction(tokenToRotate.id);
      setTokenToRotate(null);

      // Populate Connection Setup with new rotated credentials
      setSetupPrompt(res.prompt);
      setSetupConfig(res.mcpConfig);
      setSetupTab("prompt");
      setCopiedSetup(false);

      await refreshData();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      toast.error("Failed to rotate token: " + (err.message || String(err)));
    } finally {
      setIsRotating(false);
    }
  };

  const toggleScope = (scope: McpScopeKey) => {
    setSelectedScopes((current) =>
      current.includes(scope)
        ? current.filter((selected) => selected !== scope)
        : [...current, scope],
    );
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6 pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-strong">
            MCP AI Tools
          </h1>
          <p className="text-sm text-text-muted">
            Manage bearer tokens, configure client setups, and inspect live tool
            executions.
          </p>
        </div>

        {activeMainTab === "tokens" && (
          <Button
            onClick={() => setCreateModalOpen(true)}
            className="gap-2 shrink-0"
          >
            <Plus className="size-4" />
            <span>Generate Agent Token</span>
          </Button>
        )}
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-border gap-6">
        <button
          type="button"
          onClick={() => {
            setActiveMainTab("tokens");
            if (typeof window !== "undefined") {
              const url = new URL(window.location.href);
              url.searchParams.delete("tab");
              window.history.replaceState({}, "", url.toString());
            }
          }}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeMainTab === "tokens"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-text-strong"
          }`}
        >
          <KeyRound className="size-4" />
          <span>Tokens &amp; Access</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {tokens.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveMainTab("logs");
            if (typeof window !== "undefined") {
              const url = new URL(window.location.href);
              url.searchParams.set("tab", "logs");
              window.history.replaceState({}, "", url.toString());
            }
          }}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeMainTab === "logs"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-text-strong"
          }`}
        >
          <Activity className="size-4" />
          <span>Execution Logs</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {runs.length}
          </span>
        </button>
      </div>

      {activeMainTab === "tokens" ? (
        <div className="flex flex-col gap-6">
          {/* One-Time Connection Setup Banner (Same as portal-app) */}
          {setupPrompt && (
            <section
              className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-200"
              aria-labelledby="mcp-setup-heading"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <h2
                    id="mcp-setup-heading"
                    className="text-base font-bold text-text-strong"
                  >
                    Connection Setup
                  </h2>
                  <Badge
                    variant="outline"
                    className="text-amber-600 bg-amber-500/10 border-amber-500/30 text-xs font-medium"
                  >
                    Copy Before Closing
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={copyActiveSetup}
                    className="gap-1.5"
                  >
                    {copiedSetup ? (
                      <Check className="size-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                    <span>
                      {copiedSetup
                        ? "Copied"
                        : setupTab === "prompt"
                          ? "Copy Agent Prompt"
                          : "Copy Config"}
                    </span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearOneTimeSetup}
                    className="gap-1 text-muted-foreground hover:text-text-strong"
                  >
                    <X className="size-3.5" />
                    <span>Close</span>
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-primary/30 bg-card p-4 sm:p-5 flex flex-col gap-3 shadow-xs">
                <Tabs
                  value={setupTab}
                  onValueChange={(val) => {
                    setSetupTab(val as "prompt" | "config");
                    setCopiedSetup(false);
                  }}
                >
                  <TabsList className="bg-muted/70">
                    <TabsTrigger value="prompt" className="text-xs">
                      Agent Setup Prompt (Paste to Agent)
                    </TabsTrigger>
                    <TabsTrigger value="config" className="text-xs">
                      mcp_config.json
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="prompt" className="mt-3">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-semibold uppercase tracking-wider text-[11px]">
                          Global Setup Prompt for AI Agent
                        </span>
                        <span>
                          Give this prompt to Cursor, Claude Desktop,
                          Antigravity, or your agent
                        </span>
                      </div>
                      <Textarea
                        value={setupPrompt}
                        readOnly
                        rows={11}
                        className="text-xs bg-muted/40 resize-y text-text-strong selection:bg-primary/20"
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="config" className="mt-3">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-semibold uppercase tracking-wider text-[11px]">
                          Client Configuration JSON
                        </span>
                        <span>
                          Add to .cursor/mcp.json or claude_desktop_config.json
                        </span>
                      </div>
                      <Textarea
                        value={setupConfig}
                        readOnly
                        rows={14}
                        className="text-xs bg-muted/40 resize-y text-text-strong selection:bg-primary/20"
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </section>
          )}

          {/* Dedicated Agent Tokens Table */}
          <Card className="border-border bg-card shadow-xs">
            <CardHeader className="p-5 pb-3 border-b border-border">
              <CardTitle className="text-base sm:text-lg font-bold text-text-strong">
                Dedicated Agent Tokens
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Active and revoked tokens provisioned for automated AI assistant
                and agent access.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0 overflow-x-auto">
              {tokens.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center justify-center gap-3">
                  <div className="size-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
                    <KeyRound className="size-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-strong">
                      No MCP Tokens Created Yet
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Generate your first token to connect Cursor, Claude, or
                      any AI assistant.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setCreateModalOpen(true)}
                    className="mt-2"
                  >
                    Generate First Token
                  </Button>
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 text-muted-foreground border-b border-border uppercase font-semibold">
                    <tr>
                      <th className="py-3 px-4">Agent Name</th>
                      <th className="py-3 px-4">Token Prefix</th>
                      <th className="py-3 px-4">Permissions</th>
                      <th className="py-3 px-4">Scopes</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Last Used</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {tokens.map((token) => {
                      const isRevoked = Boolean(token.revokedAt);
                      const isExpired = new Date(token.expiresAt) < new Date();
                      const isActive = !isRevoked && !isExpired;

                      return (
                        <tr
                          key={token.id}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="py-3.5 px-4 font-medium text-text-strong">
                            <div className="flex items-center gap-2">
                              <Bot className="size-4 text-primary shrink-0" />
                              <span className="font-semibold">
                                {token.name}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <span>{token.prefix}...</span>
                              <button
                                type="button"
                                onClick={() =>
                                  copyToClipboard(
                                    token.prefix,
                                    `prefix-${token.id}`,
                                  )
                                }
                                className="text-muted-foreground hover:text-text-strong cursor-pointer p-0.5 rounded"
                                title="Copy prefix"
                              >
                                {copiedKey === `prefix-${token.id}` ? (
                                  <Check className="size-3 text-emerald-500" />
                                ) : (
                                  <Copy className="size-3" />
                                )}
                              </button>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            {token.readOnly ? (
                              <Badge
                                variant="outline"
                                className="text-amber-600 bg-amber-500/10 border-amber-500/20 text-[11px]"
                              >
                                Read-Only
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-emerald-600 bg-emerald-500/10 border-emerald-500/20 text-[11px]"
                              >
                                Read &amp; Write
                              </Badge>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {token.allowedScopes.includes("*") ? (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px]"
                                >
                                  Standard scopes (*)
                                </Badge>
                              ) : null}
                              {token.allowedScopes
                                .filter((scope) => scope !== "*")
                                .map((scope) => (
                                  <Badge
                                    key={scope}
                                    variant="secondary"
                                    className="text-[10px]"
                                  >
                                    {scope}
                                  </Badge>
                                ))}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            {isRevoked ? (
                              <Badge
                                variant="destructive"
                                className="text-[11px]"
                              >
                                Revoked
                              </Badge>
                            ) : isExpired ? (
                              <Badge
                                variant="outline"
                                className="text-destructive bg-destructive/10 border-destructive/20 text-[11px]"
                              >
                                Expired
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-emerald-600 bg-emerald-500/10 border-emerald-500/20 text-[11px]"
                              >
                                Active
                              </Badge>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-muted-foreground">
                            {token.lastUsedAt
                              ? new Date(token.lastUsedAt).toLocaleString()
                              : "Never"}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            {isActive ? (
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setTokenToRotate(token)}
                                  className="h-7 px-2 text-xs text-muted-foreground hover:text-text-strong"
                                  title="Rotate Token"
                                >
                                  <RotateCw className="size-3.5 mr-1" />
                                  <span>Rotate</span>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setTokenToRevoke(token)}
                                  className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                  title="Revoke Token"
                                >
                                  <Trash2 className="size-3.5 mr-1" />
                                  <span>Revoke</span>
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setTokenToDelete(token)}
                                  className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                  title="Delete Token"
                                >
                                  <Trash2 className="size-3.5 mr-1" />
                                  <span>Delete</span>
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="flex flex-col gap-4 animate-in fade-in duration-150">
          {/* Filter and Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border">
            <div className="relative flex-1 max-w-md">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by tool name or request ID..."
                value={searchLogsQuery}
                onChange={(e) => setSearchLogsQuery(e.target.value)}
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
                  Showing {filteredRuns.length} of {runs.length} recorded
                  operations
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

                            <span className="font-semibold text-xs text-text-strong">
                              {run.toolName}
                            </span>

                            {run.durationMs !== null &&
                              run.durationMs !== undefined && (
                                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                  <Clock className="size-3" />
                                  {run.durationMs}ms
                                </span>
                              )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="text-[11px]">
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
                                {isExpanded
                                  ? "Hide Details"
                                  : "Inspect Payload"}
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
                              <div className="text-[11px] text-muted-foreground">
                                <span className="font-semibold text-text-strong">
                                  Request ID:
                                </span>{" "}
                                {run.requestId}
                              </div>
                            )}

                            {run.error && (
                              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                                <strong>Execution Error:</strong> {run.error}
                              </div>
                            )}

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                              <div>
                                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                                  Input Arguments:
                                </span>
                                <pre className="p-3 bg-muted/60 border border-border rounded-lg text-[11px] text-text-strong overflow-x-auto max-h-56">
                                  {JSON.stringify(run.input || {}, null, 2)}
                                </pre>
                              </div>

                              <div>
                                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                                  Result Payload (Redacted):
                                </span>
                                <pre className="p-3 bg-muted/60 border border-border rounded-lg text-[11px] text-text-strong overflow-x-auto max-h-56">
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
      )}

      {/* Create Token Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Generate Agent Token"
        icon={<Bot className="size-5" />}
        maxWidth="2xl"
      >
        <form onSubmit={handleCreateToken} className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-text-strong block mb-1.5">
                Agent Name *
              </label>
              <Input
                type="text"
                placeholder="e.g. Cursor, Claude Desktop, Antigravity"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                required
                autoFocus
                className="w-full text-xs h-9"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-text-strong block mb-1.5">
                Expiration
              </label>
              <Select
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(Number(e.target.value))}
                className="h-9 py-1 text-xs"
              >
                <option value={30}>30 Days</option>
                <option value={90}>90 Days (Recommended)</option>
                <option value={180}>180 Days</option>
                <option value={365}>1 Year</option>
                <option value={0}>Never Expires</option>
              </Select>
            </div>
          </div>

          <label className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={isReadOnly}
              onChange={(e) => setIsReadOnly(e.target.checked)}
              className="size-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-xs font-medium text-text-strong">
              Read-Only Mode{" "}
              <span className="text-muted-foreground font-normal">
                (blocks create, update, and delete actions)
              </span>
            </span>
          </label>

          <fieldset>
            <legend className="text-xs font-semibold text-text-strong">
              Allowed Scopes
            </legend>
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setSelectedScopes((current) => {
                    const explicitScopes = current.filter(
                      (scope) => scope === "payment_operations",
                    );
                    return allStandardScopesSelected
                      ? explicitScopes
                      : [...DEFAULT_SCOPE_KEYS, ...explicitScopes];
                  });
                }}
                className="text-xs text-primary hover:underline cursor-pointer font-medium"
              >
                {allStandardScopesSelected
                  ? "Clear standard scopes"
                  : "Select standard scopes"}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {MCP_SCOPES.map((scopeItem) => {
                const checked = selectedScopes.includes(scopeItem.key);
                return (
                  <label
                    key={scopeItem.key}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all cursor-pointer text-xs select-none ${
                      checked
                        ? "border-primary/40 bg-primary/5 text-text-strong font-medium"
                        : "border-border bg-card text-muted-foreground hover:bg-muted/30"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleScope(scopeItem.key)}
                      className="size-4 rounded border-border text-primary focus:ring-primary shrink-0"
                    />
                    <span>{scopeItem.label}</span>
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Select Payment Request Decisions &amp; Exports and turn off
              Read-Only Mode to approve, reject, or export requests through MCP.
            </p>
          </fieldset>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border mt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCreateModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!agentName.trim()}
              loading={isSubmitting}
            >
              {isSubmitting ? "Generating..." : "Generate Token"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Revoke Confirmation Modal */}
      <Modal
        isOpen={Boolean(tokenToRevoke)}
        onClose={() => setTokenToRevoke(null)}
        title="Revoke Agent Token?"
        icon={<AlertTriangle className="size-5 text-destructive" />}
        maxWidth="sm"
      >
        <div className="p-6 text-center flex flex-col gap-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Are you sure you want to revoke this token? Agents using this token
            will immediately receive a 401 Unauthorized error and will no longer
            have access to the MCP tools.
          </p>

          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setTokenToRevoke(null)}
              disabled={isRevoking}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleRevokeConfirm}
              loading={isRevoking}
              className="flex-1"
            >
              {!isRevoking && <Trash2 />}
              <span>{isRevoking ? "Revoking..." : "Revoke Token"}</span>
            </Button>
          </div>
        </div>
      </Modal>

      {/* Rotate Confirmation Modal */}
      <Modal
        isOpen={Boolean(tokenToRotate)}
        onClose={() => setTokenToRotate(null)}
        title="Rotate Agent Token?"
        subtitle={`Rotate token for ${tokenToRotate?.name}`}
        icon={<RotateCw className="size-5 text-primary" />}
        maxWidth="sm"
      >
        <div className="p-6 text-center flex flex-col gap-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Rotating will immediately generate a fresh replacement token and
            permanently revoke the old token. You must update your agent
            configuration with the new token.
          </p>

          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setTokenToRotate(null)}
              disabled={isRotating}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleRotateConfirm}
              loading={isRotating}
              className="flex-1"
            >
              {!isRotating && <RotateCw />}
              <span>{isRotating ? "Rotating..." : "Rotate & Generate"}</span>
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(tokenToDelete)}
        onClose={() => setTokenToDelete(null)}
        title="Delete Revoked Token?"
        icon={<Trash2 className="size-5 text-destructive" />}
        maxWidth="sm"
      >
        <div className="p-6 text-center flex flex-col gap-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Are you sure you want to permanently delete this revoked token? This
            will remove the token record and cannot be undone.
          </p>

          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setTokenToDelete(null)}
              disabled={isDeleting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteConfirm}
              loading={isDeleting}
              className="flex-1"
            >
              {!isDeleting && <Trash2 />}
              <span>{isDeleting ? "Deleting..." : "Delete Token"}</span>
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
