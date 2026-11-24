import SCBSidebar from "@/partials/SCBSidebar";

export default function SCBToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-background text-text-default">
      <SCBSidebar />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 min-w-0">
        {children}
      </main>
    </div>
  );
}
