import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ScbToolsSkeleton() {
  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6 pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-60 sm:w-72 rounded-lg" />
          <Skeleton className="h-4 w-72 sm:w-96 rounded-md" />
        </div>
        <Skeleton className="h-10 w-44 rounded-xl" />
      </div>

      {/* Stats / Controls Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="border-border bg-card shadow-xs">
            <CardContent className="p-5 flex flex-col gap-2">
              <Skeleton className="h-3.5 w-24 rounded" />
              <Skeleton className="h-7 w-36 rounded-md" />
              <Skeleton className="h-3 w-48 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Transactions Table Card */}
      <Card className="border-border bg-card shadow-xs overflow-hidden">
        <CardHeader className="p-4 sm:p-5 flex flex-row items-center justify-between border-b border-border">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-36 rounded" />
            <Skeleton className="h-4 w-12 rounded" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-24 rounded-xl" />
            <Skeleton className="h-9 w-24 rounded-xl" />
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm text-left">
            <thead className="bg-muted/40 text-text-muted border-b border-border text-xs uppercase font-medium">
              <tr>
                <th className="px-4 py-3 w-10">
                  <Skeleton className="h-4 w-4 rounded" />
                </th>
                <th className="px-4 py-3">
                  <Skeleton className="h-4 w-28 rounded" />
                </th>
                <th className="px-4 py-3">
                  <Skeleton className="h-4 w-24 rounded" />
                </th>
                <th className="px-4 py-3">
                  <Skeleton className="h-4 w-20 rounded" />
                </th>
                <th className="px-4 py-3">
                  <Skeleton className="h-4 w-20 rounded" />
                </th>
                <th className="px-4 py-3">
                  <Skeleton className="h-4 w-24 rounded" />
                </th>
                <th className="px-4 py-3 text-right">
                  <Skeleton className="h-4 w-16 ml-auto rounded" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="hover:bg-muted/20">
                  <td className="px-4 py-3.5">
                    <Skeleton className="h-4 w-4 rounded" />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-col gap-1">
                      <Skeleton className="h-4 w-36 rounded" />
                      <Skeleton className="h-3 w-24 rounded" />
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <Skeleton className="h-4 w-28 rounded" />
                  </td>
                  <td className="px-4 py-3.5">
                    <Skeleton className="h-4 w-20 rounded" />
                  </td>
                  <td className="px-4 py-3.5">
                    <Skeleton className="h-4 w-24 rounded" />
                  </td>
                  <td className="px-4 py-3.5">
                    <Skeleton className="h-4 w-28 rounded" />
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex justify-end gap-1.5">
                      <Skeleton className="h-7 w-7 rounded-lg" />
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
