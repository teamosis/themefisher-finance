import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DebitAccountsSkeleton() {
  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6 pb-16">
      {/* Page Header */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56 sm:w-64 rounded-lg" />
        <Skeleton className="h-4 w-72 sm:w-80 rounded-md" />
      </div>

      {/* Add Account Card */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="p-5 sm:p-6 pb-2">
          <Skeleton className="h-5 w-44 rounded" />
        </CardHeader>
        <CardContent className="p-5 sm:p-6 pt-2 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
            <div className="flex flex-col gap-2 justify-end pb-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-32 rounded" />
              </div>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Skeleton className="h-10 w-32 rounded-xl" />
          </div>
        </CardContent>
      </Card>

      {/* Accounts Table Card */}
      <Card className="border-border bg-card shadow-xs overflow-hidden">
        <CardHeader className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-36 rounded" />
            <Skeleton className="h-4 w-8 rounded" />
          </div>
          <Skeleton className="h-9 w-full sm:w-64 rounded-xl" />
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-text-muted border-b border-border text-xs uppercase font-medium">
              <tr>
                <th className="px-5 py-3">
                  <Skeleton className="h-4 w-32 rounded" />
                </th>
                <th className="px-5 py-3">
                  <Skeleton className="h-4 w-24 rounded" />
                </th>
                <th className="px-5 py-3 text-center">
                  <Skeleton className="h-4 w-16 mx-auto rounded" />
                </th>
                <th className="px-5 py-3 text-right">
                  <Skeleton className="h-4 w-16 ml-auto rounded" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="hover:bg-muted/20">
                  <td className="px-5 py-3.5">
                    <Skeleton className="h-4 w-44 rounded" />
                  </td>
                  <td className="px-5 py-3.5">
                    <Skeleton className="h-4 w-28 rounded" />
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <Skeleton className="h-6 w-16 mx-auto rounded-full" />
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex justify-end gap-1.5">
                      <Skeleton className="h-8 w-8 rounded-lg" />
                      <Skeleton className="h-8 w-8 rounded-lg" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
