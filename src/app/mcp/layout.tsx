import { McpSidebar } from "@/partials/McpSidebar";

export const metadata = {
  title: "AI Agent MCP Access | Themefisher Finance",
  description:
    "Manage dedicated tokens and client configurations for AI Agents connecting via Model Context Protocol.",
};

export default function McpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-background text-text-default">
      <McpSidebar />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 min-w-0">
        {children}
      </main>
    </div>
  );
}
