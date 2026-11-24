import AppSidebar from "@/partials/app-sidebar";
import { isAuthConfigured } from "@/lib/auth";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isAuthConfigured()) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-background text-text-default">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 min-w-0">
        {children}
      </main>
    </div>
  );
}
