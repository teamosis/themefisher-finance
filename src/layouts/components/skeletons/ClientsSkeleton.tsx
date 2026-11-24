import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ClientsSkeleton() {
  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-8 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48 sm:w-56 rounded-lg" />
        <Skeleton className="h-4 w-72 sm:w-80 rounded-md" />
      </div>

      {/* Add Client Form Card */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="p-5 sm:p-6 pb-2">
          <Skeleton className="h-5 w-32 rounded" />
        </CardHeader>
        <CardContent className="p-5 sm:p-6 pt-2 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-28 rounded" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
          <div className="flex justify-end pt-2">
            <Skeleton className="h-10 w-32 rounded-xl" />
          </div>
        </CardContent>
      </Card>

      {/* Directory Card */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="p-5 sm:p-6 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-36 rounded" />
            <Skeleton className="h-4 w-12 rounded" />
          </div>
          <Skeleton className="h-9 w-full sm:w-64 rounded-xl" />
        </CardHeader>
        <div className="divide-y divide-border">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex flex-col gap-2 flex-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-40 rounded" />
                  <Skeleton className="h-4 w-24 rounded" />
                </div>
                <Skeleton className="h-3.5 w-64 rounded" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-16 rounded-xl" />
                <Skeleton className="h-8 w-16 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
