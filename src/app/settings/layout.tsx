import SettingsSidebar from "@/partials/SettingsSidebar";

export const metadata = {
  title: "Settings & Logs | Themefisher Finance",
  description:
    "System settings, AI agent MCP integration, execution logs, and application activity audit trail.",
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-background text-text-default">
      <SettingsSidebar />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 min-w-0">
        {children}
      </main>
    </div>
  );
}
